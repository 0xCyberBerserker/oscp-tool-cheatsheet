PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
  account_subject TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  pkce_verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_subject TEXT NOT NULL REFERENCES accounts(account_subject) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE vaults (
  account_subject TEXT PRIMARY KEY REFERENCES accounts(account_subject) ON DELETE CASCADE,
  vault_id TEXT NOT NULL CHECK(length(vault_id) = 22),
  revision INTEGER NOT NULL CHECK(revision > 0),
  envelope TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(account_subject, vault_id)
) WITHOUT ROWID;

CREATE TABLE records (
  account_subject TEXT NOT NULL REFERENCES accounts(account_subject) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  vault_id TEXT NOT NULL CHECK(length(vault_id) = 22),
  revision INTEGER NOT NULL CHECK(revision > 0),
  envelope TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(account_subject, record_id),
  FOREIGN KEY(account_subject, vault_id) REFERENCES vaults(account_subject, vault_id) ON DELETE CASCADE
) WITHOUT ROWID;

CREATE INDEX records_sync_idx ON records(account_subject, updated_at, record_id);
