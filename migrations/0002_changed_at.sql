-- Bumped on every sync write, so idle polls can check one row instead of
-- re-reading every entry (D1's free plan counts rows read per day).
ALTER TABLE household ADD COLUMN changed_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
UPDATE household SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
