"use strict";

const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const profileCrypto = require("../app/profile-crypto.js");

const subject = `gh1_${Buffer.alloc(32, 7).toString("base64url")}`;
const otherSubject = `gh1_${Buffer.alloc(32, 8).toString("base64url")}`;
const localSubject = `local1_${Buffer.alloc(32, 9).toString("base64url")}`;
const passphrase = "correct horse battery staple for OSCP";

async function rejects(operation) {
  await assert.rejects(operation, /Unable to (unlock|decrypt)/u);
}

(async () => {
  const { vault, key } = await profileCrypto.createVault(subject, passphrase);
  const value = { notes: { "recon:ports": "private target note" }, completed: { "recon:ports": true } };
  const first = await profileCrypto.encryptRecord(key, subject, vault.vaultId, "machine_state", 1, value);
  const second = await profileCrypto.encryptRecord(key, subject, vault.vaultId, "machine_state", 1, value);

  assert.deepEqual(await profileCrypto.decryptRecord(key, first), value);
  assert.notEqual(first.iv, second.iv, "AES-GCM IVs must never repeat");
  assert.ok(!JSON.stringify(first).includes("private target note"), "envelope leaked plaintext");
  assert.equal(vault.kdf.iterations, 600000);
  assert.equal((await crypto.subtle.exportKey("raw", key).catch(() => null)), null, "DEK must not be extractable");

  const localVault = await profileCrypto.createVault(localSubject, passphrase);
  assert.equal(localVault.vault.binding.provider, "local");
  await profileCrypto.unlockVault(localVault.vault, passphrase);
  await assert.rejects(
    profileCrypto.unlockVault({ ...localVault.vault, binding: { provider: "github", subject: localSubject } }, passphrase),
    /Unsupported identity provider/u,
  );

  await rejects(profileCrypto.unlockVault(vault, "this passphrase is definitely wrong"));
  await rejects(profileCrypto.unlockVault({ ...vault, binding: { provider: "github", subject: otherSubject } }, passphrase));

  const tamperedCiphertext = `${first.ciphertext.slice(0, -1)}${first.ciphertext.endsWith("A") ? "B" : "A"}`;
  await rejects(profileCrypto.decryptRecord(key, { ...first, ciphertext: tamperedCiphertext }));
  await rejects(profileCrypto.decryptRecord(key, { ...first, revision: 2 }));
  await rejects(profileCrypto.decryptRecord(key, { ...first, subject: otherSubject }));
  const otherVaultId = `${first.vaultId.slice(0, -1)}${first.vaultId.endsWith("A") ? "B" : "A"}`;
  await rejects(profileCrypto.decryptRecord(key, { ...first, vaultId: otherVaultId }));

  await assert.rejects(
    profileCrypto.unlockVault({ ...vault, kdf: { ...vault.kdf, iterations: 600001 } }, passphrase),
    /Unsafe PBKDF2 work factor/u,
  );

  await assert.rejects(
    profileCrypto.createVault(subject, "too short"),
    /Passphrase must contain/u,
  );
  console.log("profile crypto tests: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
