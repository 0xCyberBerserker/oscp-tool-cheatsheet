(function exposeProfileStore(root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OSCPProfileStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createProfileStoreApi() {
  "use strict";

  const ACTIVE_SUBJECT_KEY = "active_subject";
  const VAULT_PREFIX = "vault:";
  const RECORD_PREFIX = "record:";
  const SYNC_PREFIX = "sync:";

  function indexedDbBackend(indexedDB) {
    if (!indexedDB) throw new Error("IndexedDB is not available");
    const database = new Promise((resolve, reject) => {
      const request = indexedDB.open("oscp-arsenal-private", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("private");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    let fallbackLock = Promise.resolve();

    async function transaction(mode, operation) {
      const db = await database;
      return new Promise((resolve, reject) => {
        const tx = db.transaction("private", mode);
        const store = tx.objectStore("private");
        let result;
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
        result = operation(store);
      });
    }

    return Object.freeze({
      async get(key) {
        const db = await database;
        return new Promise((resolve, reject) => {
          const request = db.transaction("private", "readonly").objectStore("private").get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      },
      async putMany(entries) {
        await transaction("readwrite", (store) => {
          entries.forEach(([key, value]) => store.put(value, key));
        });
      },
      async runExclusive(operation) {
        if (globalThis.navigator?.locks) {
          return globalThis.navigator.locks.request("oscp-arsenal-private-write", operation);
        }
        const current = fallbackLock.then(operation);
        fallbackLock = current.catch(() => undefined);
        return current;
      },
    });
  }

  function createStore({ backend, crypto }) {
    if (!backend?.get || !backend?.putMany) throw new Error("Invalid encrypted profile backend");
    if (!crypto?.createVault || !crypto?.unlockVault) throw new Error("Invalid profile crypto provider");
    let key = null;
    let vault = null;
    let selectedSubject = null;
    let storeLock = Promise.resolve();

    function runExclusive(operation) {
      if (backend.runExclusive) return backend.runExclusive(operation);
      const current = storeLock.then(operation);
      storeLock = current.catch(() => undefined);
      return current;
    }

    function validateSubject(subject) {
      if (typeof subject !== "string" || !/^gh1_[A-Za-z0-9_-]{43}$/u.test(subject)) {
        throw new Error("Invalid GitHub account subject");
      }
      return subject;
    }

    async function activeSubject() {
      const subject = selectedSubject || await backend.get(ACTIVE_SUBJECT_KEY);
      return subject ? validateSubject(subject) : null;
    }

    function selectSubject(subject) {
      selectedSubject = validateSubject(subject);
    }

    function vaultStorageKey(subject) {
      return `${VAULT_PREFIX}${validateSubject(subject)}`;
    }

    function recordStorageKey(subject, recordId) {
      return `${RECORD_PREFIX}${validateSubject(subject)}:${recordId}`;
    }

    async function hasVault(subject = null) {
      const resolved = subject ? validateSubject(subject) : await activeSubject();
      return resolved ? Boolean(await backend.get(vaultStorageKey(resolved))) : false;
    }

    async function create(subject, passphrase, initialRecords = {}) {
      validateSubject(subject);
      return runExclusive(async () => {
        if (await hasVault(subject)) throw new Error("Encrypted profile already exists");
        const created = await crypto.createVault(subject, passphrase);
        const entries = [
          [ACTIVE_SUBJECT_KEY, subject],
          [vaultStorageKey(subject), created.vault],
        ];
        for (const [recordId, value] of Object.entries(initialRecords)) {
          entries.push([
            recordStorageKey(subject, recordId),
            await crypto.encryptRecord(created.key, subject, created.vault.vaultId, recordId, 1, value),
          ]);
        }
        await backend.putMany(entries);
        selectedSubject = subject;
        vault = created.vault;
        key = created.key;
        return { subject };
      });
    }

    async function unlock(passphrase) {
      const subject = await activeSubject();
      const storedVault = subject ? await backend.get(vaultStorageKey(subject)) : null;
      if (!storedVault) throw new Error("Encrypted profile does not exist");
      const unlockedKey = await crypto.unlockVault(storedVault, passphrase);
      await backend.putMany([[ACTIVE_SUBJECT_KEY, subject]]);
      vault = storedVault;
      key = unlockedKey;
      return { subject: vault.binding.subject };
    }

    function lock() {
      key = null;
      vault = null;
    }

    function requireUnlocked() {
      if (!key || !vault) throw new Error("Encrypted profile is locked");
    }

    async function load(recordId) {
      requireUnlocked();
      const envelope = await backend.get(recordStorageKey(vault.binding.subject, recordId));
      if (!envelope) return null;
      if (envelope.subject !== vault.binding.subject) throw new Error("Encrypted record account mismatch");
      return crypto.decryptRecord(key, envelope);
    }

    async function save(recordId, value) {
      requireUnlocked();
      const operation = async () => {
        const storageKey = recordStorageKey(vault.binding.subject, recordId);
        const previous = await backend.get(storageKey);
        const revision = previous ? previous.revision + 1 : 1;
        const envelope = await crypto.encryptRecord(key, vault.binding.subject, vault.vaultId, recordId, revision, value);
        await backend.putMany([[storageKey, envelope]]);
        return revision;
      };
      return runExclusive(operation);
    }

    async function exportVault() {
      const subject = vault?.binding?.subject || await activeSubject();
      return subject ? backend.get(vaultStorageKey(subject)) : null;
    }

    async function exportRecord(recordId) {
      const subject = vault?.binding?.subject || await activeSubject();
      return subject ? backend.get(recordStorageKey(subject, recordId)) : null;
    }

    async function importVault(envelope) {
      const subject = validateSubject(envelope?.binding?.subject);
      if (selectedSubject && selectedSubject !== subject) throw new Error("Encrypted profile account mismatch");
      crypto.validateVault(envelope);
      await runExclusive(async () => {
        if (await hasVault(subject)) throw new Error("Encrypted profile already exists");
        await backend.putMany([
          [ACTIVE_SUBJECT_KEY, subject],
          [vaultStorageKey(subject), envelope],
        ]);
        selectedSubject = subject;
      });
    }

    async function importRecord(envelope) {
      requireUnlocked();
      return runExclusive(async () => {
        const storedVault = await backend.get(vaultStorageKey(vault.binding.subject));
        if (!storedVault || envelope?.subject !== storedVault.binding?.subject || envelope?.vaultId !== storedVault.vaultId) {
          throw new Error("Encrypted record account mismatch");
        }
        if (typeof envelope.recordId !== "string" || !Number.isSafeInteger(envelope.revision)) {
          throw new Error("Invalid encrypted record metadata");
        }
        const storageKey = recordStorageKey(vault.binding.subject, envelope.recordId);
        const previous = await backend.get(storageKey);
        if (!previous || envelope.revision > previous.revision) {
          await crypto.decryptRecord(key, envelope);
          await backend.putMany([[storageKey, envelope]]);
          return true;
        }
        return false;
      });
    }

    async function getSyncRevision(recordId) {
      const subject = vault?.binding?.subject || await activeSubject();
      if (!subject) return 0;
      const value = await backend.get(`${SYNC_PREFIX}${subject}:${recordId}`);
      return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    }

    async function setSyncRevision(recordId, revision) {
      if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Invalid sync revision");
      const subject = vault?.binding?.subject || await activeSubject();
      if (!subject) throw new Error("Encrypted profile does not exist");
      await backend.putMany([[`${SYNC_PREFIX}${subject}:${recordId}`, revision]]);
    }

    async function migrateLegacy(records, clearLegacy) {
      requireUnlocked();
      const entries = [];
      for (const [recordId, value] of Object.entries(records)) {
        const envelope = await crypto.encryptRecord(key, vault.binding.subject, vault.vaultId, recordId, 1, value);
        entries.push([recordStorageKey(vault.binding.subject, recordId), envelope]);
      }
      await backend.putMany(entries);
      for (const [recordId, expected] of Object.entries(records)) {
        const actual = await load(recordId);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error("Encrypted profile migration verification failed");
        }
      }
      await clearLegacy();
    }

    return Object.freeze({
      hasVault,
      create,
      unlock,
      lock,
      load,
      save,
      migrateLegacy,
      exportVault,
      exportRecord,
      importVault,
      importRecord,
      activeSubject,
      selectSubject,
      getSyncRevision,
      setSyncRevision,
    });
  }

  return Object.freeze({ createStore, indexedDbBackend });
});
