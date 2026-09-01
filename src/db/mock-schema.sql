-- Local-only. Backs USE_MOCK_FOOTBALL_DATA
-- Has a single row whose finished_count is the number of mock fixtures (in MOCK_MATCHES order) that have "finished". 
-- Never applied to production (kept out of src/db/schema.sql)
-- The /api/dev/mock/* endpoints also create it on demand.
CREATE TABLE IF NOT EXISTS mock_football_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  finished_count INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO mock_football_state (id, finished_count) VALUES (1, 0);
