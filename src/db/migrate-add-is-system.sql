-- One-off patch for databases created before the CPU/signup feature existed (schema.sql's
-- CREATE TABLE already includes is_system for brand new databases, but SQLite can't add a
-- column via CREATE TABLE IF NOT EXISTS on a table that already exists).
--
-- Safe to run only ONCE per database — re-running will fail with "duplicate column name".
ALTER TABLE users ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO users (name, pin_hash, is_system) VALUES ('CPU', '', 1);
