-- Kanshou schema. One household; progress is shared because we watch together.
-- Per-person ratings and reviews arrive in Phase 3 as their own table keyed by profile.

CREATE TABLE household (
  id TEXT PRIMARY KEY,
  rotation_size INTEGER NOT NULL DEFAULT 4,
  rotation_updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE profile (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES household(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- AniList metadata we've seen, stored as JSON (title, cover, color, episodes...).
CREATE TABLE media_cache (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'ANIME',
  data TEXT NOT NULL,
  tmdb_id INTEGER,
  updated_at TEXT NOT NULL
);

CREATE TABLE entry (
  household_id TEXT NOT NULL REFERENCES household(id),
  media_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('watching', 'planning', 'completed', 'dropped', 'paused')),
  progress INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  finished_at TEXT,
  rewatch INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (household_id, media_id)
);

CREATE TABLE rotation_slot (
  household_id TEXT NOT NULL REFERENCES household(id),
  position INTEGER NOT NULL,
  media_id INTEGER,
  PRIMARY KEY (household_id, position)
);

-- Failed passphrase attempts, for lockout.
CREATE TABLE login_attempt (
  ip TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX login_attempt_ip_at ON login_attempt (ip, at);
