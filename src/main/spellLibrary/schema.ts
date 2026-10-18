export const SPELL_SCHEMA = `
CREATE TABLE IF NOT EXISTS installs (
  id TEXT PRIMARY KEY, root TEXT NOT NULL UNIQUE, current_snapshot TEXT, checked_at TEXT
);
CREATE TABLE IF NOT EXISTS source_files (
  hash TEXT PRIMARY KEY, bytes INTEGER NOT NULL, compressed_bytes INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS contents (id TEXT PRIMARY KEY, hashes TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY, content_id TEXT NOT NULL REFERENCES contents(id),
  parser_version TEXT NOT NULL, first_observed TEXT NOT NULL, record_count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY, hash TEXT NOT NULL UNIQUE, spell_id INTEGER NOT NULL, record TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id), spell_id INTEGER NOT NULL,
  revision_id INTEGER NOT NULL REFERENCES revisions(id), PRIMARY KEY(snapshot_id,spell_id)
);
CREATE INDEX IF NOT EXISTS members_revision ON members(revision_id);
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY, install_id TEXT NOT NULL REFERENCES installs(id), observed_at TEXT NOT NULL,
  reason TEXT NOT NULL, outcome TEXT NOT NULL, snapshot_id TEXT REFERENCES snapshots(id),
  previous_snapshot_id TEXT REFERENCES snapshots(id), message TEXT NOT NULL, counts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS observations_install ON observations(install_id,id DESC);
PRAGMA user_version=1;
`
