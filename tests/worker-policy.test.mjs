import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
Object.defineProperty(globalThis, "btoa", {
  value: (value) => Buffer.from(value, "binary").toString("base64"),
  configurable: true,
});
const { default: worker, testing } = await import("../sync/src/worker.mjs");

const first = await testing.accountSubject(12345, "pepper-one-with-enough-entropy");
const again = await testing.accountSubject(12345, "pepper-one-with-enough-entropy");
const other = await testing.accountSubject(12346, "pepper-one-with-enough-entropy");
assert.match(first, /^gh1_[A-Za-z0-9_-]{43}$/u);
assert.equal(first, again);
assert.notEqual(first, other);
assert.ok(!first.includes("12345"));

const cookie = testing.sessionCookie("opaque-token");
assert.match(cookie, /^__Host-oscp_session=/u);
for (const attribute of ["Path=/", "Secure", "HttpOnly", "SameSite=Lax"]) assert.ok(cookie.includes(attribute));
const oauthCookie = testing.oauthCookie("browser-binding");
assert.match(oauthCookie, /^__Host-oscp_oauth=/u);
assert.ok(oauthCookie.includes("Max-Age=600"));
assert.equal(testing.validSecret("short"), false);
assert.equal(testing.validSecret("x".repeat(32)), true);

const vaultId = Buffer.alloc(16, 4).toString("base64url");
const vault = {
  schemaVersion: 1,
  cipher: "AES-256-GCM",
  vaultId,
  binding: { provider: "github", subject: first },
  kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 600000, salt: Buffer.alloc(32, 5).toString("base64url") },
  wrappedKey: { algorithm: "AES-256-GCM", iv: Buffer.alloc(12, 6).toString("base64url"), ciphertext: Buffer.alloc(48, 7).toString("base64url") },
};
assert.equal(testing.validVaultEnvelope(vault, first), true);
assert.equal(testing.validVaultEnvelope({ ...vault, kdf: { ...vault.kdf, iterations: 600001 } }, first), false);
assert.equal(testing.validVaultEnvelope({ ...vault, vaultId: Buffer.alloc(16, 8).toString("base64url") }, first), true);

const record = {
  schemaVersion: 1,
  cipher: "AES-256-GCM",
  subject: first,
  vaultId,
  recordId: "private_state",
  revision: 1,
  iv: Buffer.alloc(12, 8).toString("base64url"),
  ciphertext: Buffer.alloc(48, 9).toString("base64url"),
};
assert.equal(testing.validRecordEnvelope(record, first, "private_state", 1, vaultId), true);
assert.equal(testing.validRecordEnvelope({ ...record, vaultId: Buffer.alloc(16, 3).toString("base64url") }, first, "private_state", 1, vaultId), false);

const env = { APP_ORIGIN: "https://arsenal.example.com" };
const health = await worker.fetch(new Request("https://arsenal.example.com/health"), env);
assert.equal(health.status, 200);
assert.equal(health.headers.get("Cache-Control"), "no-store");
assert.deepEqual(await health.json(), { status: "ok" });

const unauthenticated = await worker.fetch(new Request("https://arsenal.example.com/api/v1/session"), env);
assert.equal(unauthenticated.status, 401);
assert.deepEqual(await unauthenticated.json(), { error: "unauthenticated" });

const authWithoutLimiter = await worker.fetch(new Request("https://arsenal.example.com/auth/github/start"), env);
assert.equal(authWithoutLimiter.status, 503);

const rejectedPreflight = await worker.fetch(new Request("https://arsenal.example.com/api/v1/records", {
  method: "OPTIONS",
  headers: { Origin: "https://attacker.example" },
}), env);
assert.equal(rejectedPreflight.status, 403);
assert.equal(rejectedPreflight.headers.get("Access-Control-Allow-Origin"), null);

const migration = await readFile(new URL("../sync/migrations/0001_initial.sql", import.meta.url), "utf8");
assert.match(migration, /vault_id TEXT NOT NULL/u);
assert.match(migration, /FOREIGN KEY\(account_subject, vault_id\)/u);

console.log("worker policy tests: OK");
