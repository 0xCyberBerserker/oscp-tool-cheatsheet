"use strict";

const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const profileCrypto = require("../app/profile-crypto.js");
const { createStore } = require("../app/profile-store.js");

function memoryBackend() {
  const values = new Map();
  return {
    values,
    async get(key) { return structuredClone(values.get(key)); },
    async putMany(entries) {
      const next = new Map(values);
      entries.forEach(([key, value]) => next.set(key, structuredClone(value)));
      values.clear();
      next.forEach((value, key) => values.set(key, value));
    },
  };
}

(async () => {
  const backend = memoryBackend();
  const store = createStore({ backend, crypto: profileCrypto });
  const subject = `gh1_${Buffer.alloc(32, 9).toString("base64url")}`;
  const passphrase = "a strong independent profile passphrase";
  const legacy = { notes: { "recon:ports": "legacy private note" }, progress: { "recon:ports": true } };
  let cleared = false;

  await store.create(subject, passphrase);
  await store.migrateLegacy(legacy, async () => { cleared = true; });
  assert.equal(cleared, true);
  assert.deepEqual(await store.load("notes"), legacy.notes);
  assert.deepEqual(await store.load("progress"), legacy.progress);
  assert.ok(!JSON.stringify([...backend.values]).includes("legacy private note"));

  assert.equal(await store.save("notes", { changed: true }), 2);
  assert.equal(await store.getSyncRevision("notes"), 0);
  await store.setSyncRevision("notes", 2);
  assert.equal(await store.getSyncRevision("notes"), 2);
  store.lock();
  await assert.rejects(store.load("notes"), /locked/u);
  await assert.rejects(store.unlock("wrong but sufficiently long passphrase"), /Unable to unlock/u);
  await store.unlock(passphrase);
  assert.deepEqual(await store.load("notes"), { changed: true });
  assert.equal((await store.exportVault()).binding.subject, subject);
  const exported = await store.exportRecord("notes");
  assert.equal(exported.revision, 2);

  const mismatchedBackend = memoryBackend();
  const mismatchedStore = createStore({ backend: mismatchedBackend, crypto: profileCrypto });
  await mismatchedStore.create(subject, "different vault for the same github account");
  await assert.rejects(mismatchedStore.importRecord(exported), /account mismatch/u);

  const secondBackend = memoryBackend();
  const secondStore = createStore({ backend: secondBackend, crypto: profileCrypto });
  await secondStore.importVault(await store.exportVault());
  await secondStore.unlock(passphrase);
  assert.equal(await secondStore.importRecord(exported), true);
  assert.equal(await secondStore.importRecord(exported), false, "same revision must not overwrite");
  assert.deepEqual(await secondStore.load("notes"), { changed: true });

  const failingBackend = memoryBackend();
  const failingStore = createStore({ backend: failingBackend, crypto: profileCrypto });
  await failingStore.create(subject, passphrase);
  let unsafeClear = false;
  const original = failingBackend.putMany;
  failingBackend.putMany = async (entries) => {
    await original(entries);
    const record = failingBackend.values.get(`record:${subject}:notes`);
    if (record) record.ciphertext = `${record.ciphertext[0] === "A" ? "B" : "A"}${record.ciphertext.slice(1)}`;
  };
  await assert.rejects(
    failingStore.migrateLegacy({ notes: legacy.notes }, async () => { unsafeClear = true; }),
    /Unable to decrypt|verification failed/u,
  );
  assert.equal(unsafeClear, false, "plaintext must survive a failed migration");

  const otherSubject = `gh1_${Buffer.alloc(32, 10).toString("base64url")}`;
  store.lock();
  store.selectSubject(otherSubject);
  assert.equal(await store.hasVault(), false);
  await store.create(otherSubject, "another independent account passphrase", { notes: { owner: "other" } });
  assert.equal(await store.hasVault(subject), true);
  assert.equal(await store.hasVault(otherSubject), true);
  assert.deepEqual(await store.load("notes"), { owner: "other" });

  const racingBackend = memoryBackend();
  const racingStore = createStore({ backend: racingBackend, crypto: profileCrypto });
  const racingSubject = `gh1_${Buffer.alloc(32, 11).toString("base64url")}`;
  const results = await Promise.allSettled([
    racingStore.create(racingSubject, "first concurrent profile passphrase"),
    racingStore.create(racingSubject, "second concurrent profile passphrase"),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), ["fulfilled", "rejected"]);
  console.log("profile store tests: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
