CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deactivated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users (name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pin_resets (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS gameweek_reminders (
  gameweek_id INTEGER NOT NULL REFERENCES gameweeks(id),
  kind TEXT NOT NULL CHECK (kind IN ('24h', '3h')),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (gameweek_id, kind)
);

CREATE TABLE IF NOT EXISTS season_summaries (
  season_end_date TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gameweeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matchday INTEGER NOT NULL UNIQUE,
  deadline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'scored'))
);

CREATE TABLE IF NOT EXISTS fixtures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gameweek_id INTEGER NOT NULL REFERENCES gameweeks(id),
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff_time TEXT NOT NULL,
  pl_match_id INTEGER NOT NULL,
  result TEXT CHECK (result IN ('HOME', 'AWAY', 'DRAW'))
);

CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
  pick TEXT NOT NULL CHECK (pick IN ('HOME', 'AWAY', 'DRAW')),
  points_awarded INTEGER,
  UNIQUE (user_id, fixture_id)
);

-- A fixture the football API reported as unplayable (POSTPONED / CANCELLED / SUSPENDED).
-- Its result stays NULL forever; settlement treats a voided fixture as "done" so one dead
-- match can't freeze its gameweek (and the whole season) from ever settling. Terminal: once
-- a row exists the scoring loop skips that fixture. reason holds the football-data status.
CREATE TABLE IF NOT EXISTS voided_fixtures (
  fixture_id INTEGER PRIMARY KEY REFERENCES fixtures(id),
  reason TEXT NOT NULL,
  voided_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fixtures_gameweek ON fixtures (gameweek_id);
CREATE INDEX IF NOT EXISTS idx_predictions_fixture ON predictions (fixture_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- "CPU" always predicts a home win for every fixture
-- It's a system account: pin_hash is meaningless since is_system users are always rejected at login.
INSERT OR IGNORE INTO users (name, pin_hash, is_system, email) VALUES ('CPU', '', 1, 'cpu@system.local');
