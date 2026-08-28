const SESSION_COOKIE = "__Host-oscp_session";
const OAUTH_COOKIE = "__Host-oscp_oauth";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const MAX_VAULT_BYTES = 64 * 1024;
const MAX_RECORD_BYTES = 256 * 1024;
const SUBJECT_PATTERN = /^gh1_[A-Za-z0-9_-]{43}$/u;
const VAULT_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/u;
const RECORD_ID_PATTERN = /^[A-Za-z0-9_-]{3,128}$/u;
const encoder = new TextEncoder();

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function randomToken(bytes = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function validSecret(value, minimumBytes = 32) {
  return typeof value === "string" && encoder.encode(value).byteLength >= minimumBytes && !/^(undefined|null|replace|changeme)/iu.test(value);
}

async function digest(value) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function accountSubject(githubId, pepper) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`github:${githubId}`));
  return `gh1_${base64Url(new Uint8Array(signature))}`;
}

function cookieValue(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

function sessionCookie(token, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function oauthCookie(token, maxAge = 600) {
  return `${OAUTH_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function responseHeaders(env, request) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.headers.get("Origin") === env.APP_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", env.APP_ORIGIN);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }
  return headers;
}

function json(env, request, status, body, extraHeaders = {}) {
  const headers = responseHeaders(env, request);
  headers.set("Content-Type", "application/json; charset=utf-8");
  Object.entries(extraHeaders).forEach(([name, value]) => headers.set(name, value));
  return new Response(JSON.stringify(body), { status, headers });
}

function exactOrigin(request, env) {
  return request.headers.get("Origin") === env.APP_ORIGIN;
}

function validBase64Url(value, minimum, maximum) {
  return typeof value === "string" && value.length >= minimum && value.length <= maximum && /^[A-Za-z0-9_-]+$/u.test(value);
}

function validVaultEnvelope(envelope, subject) {
  return envelope?.schemaVersion === 1 &&
    envelope.cipher === "AES-256-GCM" &&
    VAULT_ID_PATTERN.test(envelope.vaultId || "") &&
    envelope.binding?.provider === "github" &&
    envelope.binding.subject === subject &&
    envelope.kdf?.name === "PBKDF2" &&
    envelope.kdf.hash === "SHA-256" &&
    envelope.kdf.iterations === 600000 &&
    validBase64Url(envelope.kdf.salt, 43, 43) &&
    envelope.wrappedKey?.algorithm === "AES-256-GCM" &&
    validBase64Url(envelope.wrappedKey.iv, 16, 16) &&
    validBase64Url(envelope.wrappedKey.ciphertext, 43, 256);
}

function validRecordEnvelope(envelope, subject, recordId, revision, vaultId) {
  return envelope?.schemaVersion === 1 &&
    envelope.cipher === "AES-256-GCM" &&
    envelope.subject === subject &&
    envelope.recordId === recordId &&
    envelope.revision === revision &&
    envelope.vaultId === vaultId &&
    validBase64Url(envelope.iv, 16, 16) &&
    validBase64Url(envelope.ciphertext, 22, MAX_RECORD_BYTES);
}

async function readJson(request, maximumBytes) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    throw new Response("JSON required", { status: 415 });
  }
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > maximumBytes) throw new Response("Payload too large", { status: 413 });
  const text = await request.text();
  if (encoder.encode(text).byteLength > maximumBytes) throw new Response("Payload too large", { status: 413 });
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Response("Invalid JSON", { status: 400 });
  }
}

async function authenticatedSubject(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) return null;
  const tokenHash = await digest(token);
  const row = await env.DB.prepare(
    "SELECT account_subject FROM sessions WHERE token_hash = ? AND expires_at > ?",
  ).bind(tokenHash, Math.floor(Date.now() / 1000)).first();
  return row?.account_subject || null;
}

async function beginGithub(request, env) {
  if (!validSecret(env.ACCOUNT_PEPPER_V1) || !env.GITHUB_CLIENT_ID || !env.API_ORIGIN || !env.APP_ORIGIN) {
    return json(env, request, 503, { error: "auth_not_configured" });
  }
  if (!env.AUTH_RATE_LIMITER) return json(env, request, 503, { error: "auth_rate_limiter_unavailable" });
  const clientKey = request.headers.get("CF-Connecting-IP") || "unknown";
  const rate = await env.AUTH_RATE_LIMITER.limit({ key: clientKey });
  if (!rate.success) return json(env, request, 429, { error: "rate_limited" });
  const state = randomToken();
  const verifier = randomToken();
  const browserBinding = randomToken();
  const challenge = await digest(verifier);
  const expiresAt = Math.floor(Date.now() / 1000) + 600;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(Math.floor(Date.now() / 1000)),
    env.DB.prepare(
      "INSERT INTO oauth_states (state_hash, browser_hash, pkce_verifier, expires_at) VALUES (?, ?, ?, ?)",
    ).bind(await digest(state), await digest(browserBinding), verifier, expiresAt),
  ]);

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${env.API_ORIGIN}/auth/github/callback`);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("allow_signup", "false");
  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString(), "Set-Cookie": oauthCookie(browserBinding), "Cache-Control": "no-store" },
  });
}

async function finishGithub(request, env) {
  if (!validSecret(env.ACCOUNT_PEPPER_V1) || !validSecret(env.GITHUB_CLIENT_SECRET) || !env.GITHUB_CLIENT_ID) {
    return json(env, request, 503, { error: "auth_not_configured" });
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const browserBinding = cookieValue(request, OAUTH_COOKIE);
  if (!code || !/^[A-Za-z0-9_-]{43}$/u.test(state) || !/^[A-Za-z0-9_-]{43}$/u.test(browserBinding)) {
    return json(env, request, 400, { error: "invalid_callback" });
  }

  const now = Math.floor(Date.now() / 1000);
  const stateHash = await digest(state);
  const stored = await env.DB.prepare(
    "SELECT pkce_verifier FROM oauth_states WHERE state_hash = ? AND browser_hash = ? AND expires_at > ?",
  ).bind(stateHash, await digest(browserBinding), now).first();
  if (!stored) return json(env, request, 400, { error: "invalid_state" });
  await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash = ?").bind(stateHash).run();

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "oscp-arsenal-sync" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${env.API_ORIGIN}/auth/github/callback`,
      code_verifier: stored.pkce_verifier,
    }),
  });
  if (!tokenResponse.ok) return json(env, request, 502, { error: "github_token_exchange_failed" });
  const tokenBody = await tokenResponse.json();
  if (typeof tokenBody.access_token !== "string") return json(env, request, 502, { error: "github_token_missing" });

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenBody.access_token}`,
      "User-Agent": "oscp-arsenal-sync",
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });
  if (!userResponse.ok) return json(env, request, 502, { error: "github_identity_failed" });
  const user = await userResponse.json();
  if (!Number.isSafeInteger(user.id) || user.id < 1) return json(env, request, 502, { error: "github_identity_invalid" });

  const subject = await accountSubject(user.id, env.ACCOUNT_PEPPER_V1);
  const sessionToken = randomToken();
  const sessionHash = await digest(sessionToken);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO accounts (account_subject, created_at, last_seen_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(account_subject) DO UPDATE SET last_seen_at = excluded.last_seen_at",
    ).bind(subject, now, now),
    env.DB.prepare(
      "INSERT INTO sessions (token_hash, account_subject, expires_at) VALUES (?, ?, ?)",
    ).bind(sessionHash, subject, now + SESSION_SECONDS),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
  ]);
  await env.DB.prepare(
    "DELETE FROM sessions WHERE account_subject = ? AND token_hash NOT IN " +
    "(SELECT token_hash FROM sessions WHERE account_subject = ? ORDER BY expires_at DESC LIMIT 10)",
  ).bind(subject, subject).run();
  const headers = new Headers({ Location: `${env.APP_ORIGIN}/?auth=connected` });
  headers.set("Set-Cookie", sessionCookie(sessionToken));
  headers.append("Set-Cookie", oauthCookie("", 0));
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 302, headers });
}

async function apiRequest(request, env, pathname) {
  const subject = await authenticatedSubject(request, env);
  if (!subject) return json(env, request, 401, { error: "unauthenticated" });

  if (pathname === "/api/v1/session" && request.method === "GET") {
    return json(env, request, 200, { authenticated: true, subject });
  }
  if (pathname === "/api/v1/vault" && request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT envelope, revision FROM vaults WHERE account_subject = ?",
    ).bind(subject).first();
    return json(env, request, 200, row ? { envelope: JSON.parse(row.envelope), revision: row.revision } : { envelope: null });
  }
  if (pathname === "/api/v1/vault" && request.method === "PUT") {
    if (!exactOrigin(request, env)) return json(env, request, 403, { error: "origin_rejected" });
    const body = await readJson(request, MAX_VAULT_BYTES);
    if (!validVaultEnvelope(body?.envelope, subject)) {
      return json(env, request, 400, { error: "vault_binding_mismatch" });
    }
    const revision = Number(body.revision);
    const baseRevision = Number(body.baseRevision);
    if (!Number.isSafeInteger(revision) || revision < 1 || !Number.isSafeInteger(baseRevision) || baseRevision < 0 || revision <= baseRevision) {
      return json(env, request, 400, { error: "invalid_revision" });
    }
    const current = await env.DB.prepare(
      "SELECT revision, vault_id FROM vaults WHERE account_subject = ?",
    ).bind(subject).first();
    if ((!current && baseRevision !== 0) || (current && (current.revision !== baseRevision || current.vault_id !== body.envelope.vaultId))) {
      return json(env, request, 409, { error: "revision_conflict" });
    }
    const result = await env.DB.prepare(
      "INSERT INTO vaults (account_subject, vault_id, revision, envelope, updated_at) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(account_subject) DO UPDATE SET revision = excluded.revision, envelope = excluded.envelope, updated_at = excluded.updated_at " +
      "WHERE vaults.revision = ? AND vaults.vault_id = excluded.vault_id",
    ).bind(subject, body.envelope.vaultId, revision, JSON.stringify(body.envelope), Math.floor(Date.now() / 1000), baseRevision).run();
    if (!result.meta.changes) return json(env, request, 409, { error: "revision_conflict" });
    return json(env, request, 200, { revision });
  }
  if (pathname === "/api/v1/records" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT record_id, revision, envelope, updated_at FROM records WHERE account_subject = ? ORDER BY updated_at, record_id",
    ).bind(subject).all();
    return json(env, request, 200, {
      records: rows.results.map((row) => ({
        recordId: row.record_id,
        revision: row.revision,
        envelope: JSON.parse(row.envelope),
        updatedAt: row.updated_at,
      })),
    });
  }
  if (pathname === "/api/v1/records" && request.method === "PUT") {
    if (!exactOrigin(request, env)) return json(env, request, 403, { error: "origin_rejected" });
    const body = await readJson(request, MAX_RECORD_BYTES);
    const envelope = body?.envelope;
    const baseRevision = Number(body.baseRevision);
    if (!RECORD_ID_PATTERN.test(body.recordId || "") || !Number.isSafeInteger(body.revision) || body.revision < 1 ||
        !Number.isSafeInteger(baseRevision) || baseRevision < 0 || body.revision <= baseRevision) {
      return json(env, request, 400, { error: "invalid_record" });
    }
    const activeVault = await env.DB.prepare(
      "SELECT vault_id FROM vaults WHERE account_subject = ?",
    ).bind(subject).first();
    if (!activeVault || !validRecordEnvelope(envelope, subject, body.recordId, body.revision, activeVault.vault_id)) {
      return json(env, request, 400, { error: "record_binding_mismatch" });
    }
    const current = await env.DB.prepare(
      "SELECT revision, vault_id FROM records WHERE account_subject = ? AND record_id = ?",
    ).bind(subject, body.recordId).first();
    if ((!current && baseRevision !== 0) || (current && (current.revision !== baseRevision || current.vault_id !== activeVault.vault_id))) {
      return json(env, request, 409, { error: "revision_conflict" });
    }
    const result = await env.DB.prepare(
      "INSERT INTO records (account_subject, record_id, vault_id, revision, envelope, updated_at) VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(account_subject, record_id) DO UPDATE SET revision = excluded.revision, envelope = excluded.envelope, updated_at = excluded.updated_at " +
      "WHERE records.revision = ? AND records.vault_id = excluded.vault_id",
    ).bind(subject, body.recordId, activeVault.vault_id, body.revision, JSON.stringify(envelope), Math.floor(Date.now() / 1000), baseRevision).run();
    if (!result.meta.changes) return json(env, request, 409, { error: "revision_conflict" });
    return json(env, request, 200, { recordId: body.recordId, revision: body.revision });
  }
  return json(env, request, 404, { error: "not_found" });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") {
        if (!exactOrigin(request, env)) return json(env, request, 403, { error: "origin_rejected" });
        const headers = responseHeaders(env, request);
        headers.set("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type");
        return new Response(null, { status: 204, headers });
      }
      if (url.pathname === "/health" && request.method === "GET") return json(env, request, 200, { status: "ok" });
      if (url.pathname === "/auth/github/start" && request.method === "GET") return beginGithub(request, env);
      if (url.pathname === "/auth/github/callback" && request.method === "GET") return finishGithub(request, env);
      if (url.pathname === "/auth/logout" && request.method === "POST") {
        if (!exactOrigin(request, env)) return json(env, request, 403, { error: "origin_rejected" });
        const token = cookieValue(request, SESSION_COOKIE);
        if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(token)).run();
        return json(env, request, 200, { loggedOut: true }, { "Set-Cookie": sessionCookie("", 0) });
      }
      if (url.pathname.startsWith("/api/")) return apiRequest(request, env, url.pathname);
      return json(env, request, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof Response) return error;
      console.error(JSON.stringify({ event: "request_failed", name: error?.name || "Error" }));
      return json(env, request, 500, { error: "internal_error" });
    }
  },
};

export const testing = Object.freeze({
  accountSubject,
  sessionCookie,
  oauthCookie,
  validVaultEnvelope,
  validRecordEnvelope,
  validSecret,
});
