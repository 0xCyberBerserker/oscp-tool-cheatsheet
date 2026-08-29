(function exposeProfileCrypto(root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OSCPProfileCrypto = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createProfileCrypto() {
  "use strict";

  const SCHEMA_VERSION = 1;
  const PBKDF2_ITERATIONS = 600000;
  const SALT_BYTES = 32;
  const IV_BYTES = 12;
  const VAULT_ID_BYTES = 16;
  const SUBJECT_PATTERN = /^(?:gh1|local1)_[A-Za-z0-9_-]{43}$/;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });

  function cryptoApi() {
    if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
      throw new Error("Web Crypto is not available");
    }
    return globalThis.crypto;
  }

  function bytesToBase64Url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const base64 = typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
  }

  function base64UrlToBytes(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) {
      throw new Error("Invalid base64url value");
    }
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary");
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function validateSubject(subject) {
    if (!SUBJECT_PATTERN.test(subject)) throw new Error("Invalid profile subject");
  }

  function identityProvider(subject) {
    return subject.startsWith("gh1_") ? "github" : "local";
  }

  function validatePassphrase(passphrase) {
    if (typeof passphrase !== "string" || [...passphrase].length < 16 || passphrase.length > 1024) {
      throw new Error("Passphrase must contain between 16 and 1024 characters");
    }
  }

  function validateVaultId(vaultId) {
    if (typeof vaultId !== "string" || !/^[A-Za-z0-9_-]{22}$/u.test(vaultId)) {
      throw new Error("Invalid encrypted profile identifier");
    }
  }

  function wrapAdditionalData(subject, vaultId) {
    return encoder.encode(JSON.stringify({
      kind: "oscp-profile-key",
      schemaVersion: SCHEMA_VERSION,
      provider: identityProvider(subject),
      subject,
      vaultId,
    }));
  }

  function recordAdditionalData(subject, vaultId, recordId, revision) {
    validateVaultId(vaultId);
    if (typeof recordId !== "string" || !/^[A-Za-z0-9_-]{3,128}$/u.test(recordId)) {
      throw new Error("Invalid record identifier");
    }
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Invalid record revision");
    return encoder.encode(JSON.stringify({
      kind: "oscp-private-record",
      schemaVersion: SCHEMA_VERSION,
      subject,
      vaultId,
      recordId,
      revision,
    }));
  }

  async function deriveWrappingKey(passphrase, salt, iterations) {
    validatePassphrase(passphrase);
    if (iterations !== PBKDF2_ITERATIONS) {
      throw new Error("Unsafe PBKDF2 work factor");
    }
    const api = cryptoApi();
    const material = await api.subtle.importKey(
      "raw",
      encoder.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return api.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["wrapKey", "unwrapKey"],
    );
  }

  function validateVault(vault) {
    if (!vault || vault.schemaVersion !== SCHEMA_VERSION || vault.cipher !== "AES-256-GCM") {
      throw new Error("Unsupported encrypted profile");
    }
    validateSubject(vault.binding?.subject);
    validateVaultId(vault.vaultId);
    if (vault.binding.provider !== identityProvider(vault.binding.subject)) throw new Error("Unsupported identity provider");
    if (vault.kdf?.name !== "PBKDF2" || vault.kdf.hash !== "SHA-256") {
      throw new Error("Unsupported key derivation function");
    }
    if (vault.kdf.iterations !== PBKDF2_ITERATIONS) {
      throw new Error("Unsafe PBKDF2 work factor");
    }
    if (base64UrlToBytes(vault.kdf.salt).length !== SALT_BYTES) throw new Error("Invalid KDF salt");
    if (base64UrlToBytes(vault.wrappedKey.iv).length !== IV_BYTES) throw new Error("Invalid wrapping IV");
    if (base64UrlToBytes(vault.wrappedKey.ciphertext).length < 32) throw new Error("Invalid wrapped key");
  }

  async function createVault(subject, passphrase) {
    validateSubject(subject);
    validatePassphrase(passphrase);
    const api = cryptoApi();
    const salt = api.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = api.getRandomValues(new Uint8Array(IV_BYTES));
    const vaultId = bytesToBase64Url(api.getRandomValues(new Uint8Array(VAULT_ID_BYTES)));
    const wrappingKey = await deriveWrappingKey(passphrase, salt, PBKDF2_ITERATIONS);
    const extractableKey = await api.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const ciphertext = await api.subtle.wrapKey(
      "raw",
      extractableKey,
      wrappingKey,
      { name: "AES-GCM", iv, additionalData: wrapAdditionalData(subject, vaultId), tagLength: 128 },
    );
    const vault = {
      schemaVersion: SCHEMA_VERSION,
      cipher: "AES-256-GCM",
      vaultId,
      binding: { provider: identityProvider(subject), subject },
      kdf: {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64Url(salt),
      },
      wrappedKey: {
        algorithm: "AES-256-GCM",
        iv: bytesToBase64Url(iv),
        ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
      },
    };
    return { vault, key: await unlockVault(vault, passphrase) };
  }

  async function unlockVault(vault, passphrase) {
    validateVault(vault);
    const api = cryptoApi();
    const salt = base64UrlToBytes(vault.kdf.salt);
    const iv = base64UrlToBytes(vault.wrappedKey.iv);
    const wrappingKey = await deriveWrappingKey(passphrase, salt, vault.kdf.iterations);
    try {
      return await api.subtle.unwrapKey(
        "raw",
        base64UrlToBytes(vault.wrappedKey.ciphertext),
        wrappingKey,
        {
          name: "AES-GCM",
          iv,
          additionalData: wrapAdditionalData(vault.binding.subject, vault.vaultId),
          tagLength: 128,
        },
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    } catch (_) {
      throw new Error("Unable to unlock encrypted profile");
    }
  }

  async function encryptRecord(key, subject, vaultId, recordId, revision, value) {
    validateSubject(subject);
    const additionalData = recordAdditionalData(subject, vaultId, recordId, revision);
    const iv = cryptoApi().getRandomValues(new Uint8Array(IV_BYTES));
    const plaintext = encoder.encode(JSON.stringify(value));
    const ciphertext = await cryptoApi().subtle.encrypt(
      { name: "AES-GCM", iv, additionalData, tagLength: 128 },
      key,
      plaintext,
    );
    plaintext.fill(0);
    return {
      schemaVersion: SCHEMA_VERSION,
      subject,
      vaultId,
      recordId,
      revision,
      cipher: "AES-256-GCM",
      iv: bytesToBase64Url(iv),
      ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    };
  }

  async function decryptRecord(key, envelope) {
    if (!envelope || envelope.schemaVersion !== SCHEMA_VERSION || envelope.cipher !== "AES-256-GCM") {
      throw new Error("Unsupported encrypted record");
    }
    validateSubject(envelope.subject);
    const additionalData = recordAdditionalData(envelope.subject, envelope.vaultId, envelope.recordId, envelope.revision);
    const iv = base64UrlToBytes(envelope.iv);
    if (iv.length !== IV_BYTES) throw new Error("Invalid record IV");
    try {
      const plaintext = await cryptoApi().subtle.decrypt(
        { name: "AES-GCM", iv, additionalData, tagLength: 128 },
        key,
        base64UrlToBytes(envelope.ciphertext),
      );
      return JSON.parse(decoder.decode(plaintext));
    } catch (_) {
      throw new Error("Unable to decrypt encrypted record");
    }
  }

  return Object.freeze({
    PBKDF2_ITERATIONS,
    validateVault,
    createVault,
    unlockVault,
    encryptRecord,
    decryptRecord,
  });
});
