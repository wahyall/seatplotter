-- Partnered import uses app code (lib/import-mirror-pair-slugs.ts), not a column.
-- No-op if this column was never created; cleans up if an earlier local migration added it.
DROP INDEX IF EXISTS idx_events_import_mirror;
ALTER TABLE events DROP COLUMN IF EXISTS import_mirror_event_id;
