-- One-off patch for databases created before the email/PIN-recovery feature existed.
-- Safe to run only ONCE per database — re-running the ALTER will fail with "duplicate column name".
ALTER TABLE users ADD COLUMN email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS pin_resets (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT
);
