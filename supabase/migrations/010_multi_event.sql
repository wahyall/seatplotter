-- 010_multi_event.sql
-- Evolve single-event config table into multi-event support.
-- Renames config -> events, adds slug, scopes layouts & participants by event_id.

-- 1. Rename config -> events
ALTER TABLE config RENAME TO events;

-- 2. Add slug column with a temporary default so existing row gets a value
ALTER TABLE events ADD COLUMN slug text;

UPDATE events SET slug = 'ittiba-disconnect-sby' WHERE slug IS NULL;

ALTER TABLE events ALTER COLUMN slug SET NOT NULL;

ALTER TABLE events ADD CONSTRAINT events_slug_unique UNIQUE (slug);

-- 3. Migrate RLS policy names (old table name in policy references)
DROP POLICY IF EXISTS "allow_public_all" ON events;

CREATE POLICY "allow_public_all" ON events FOR ALL TO anon USING (true)
WITH
    CHECK (true);

-- 4. Add event_id to layouts
ALTER TABLE layouts
ADD COLUMN event_id uuid REFERENCES events (id) ON DELETE CASCADE;

-- Backfill: assign all existing layouts to the existing event
UPDATE layouts SET event_id = ( SELECT id FROM events LIMIT 1 );

ALTER TABLE layouts ALTER COLUMN event_id SET NOT NULL;

-- Replace the old UNIQUE(gender) with UNIQUE(event_id, gender)
ALTER TABLE layouts DROP CONSTRAINT IF EXISTS layouts_gender_key;

ALTER TABLE layouts
ADD CONSTRAINT layouts_event_gender_unique UNIQUE (event_id, gender);

-- 5. Add event_id to participants
ALTER TABLE participants
ADD COLUMN event_id uuid REFERENCES events (id) ON DELETE CASCADE;

-- Backfill: assign all existing participants to the existing event
UPDATE participants SET event_id = ( SELECT id FROM events LIMIT 1 );

ALTER TABLE participants ALTER COLUMN event_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_participants_event ON participants (event_id);

-- 6. Seed second event + layouts
DO $$
DECLARE
  new_event_id uuid;
BEGIN
  INSERT INTO events (event_name, event_date, event_venue, stage_label, scan_qr_url, slug)
  VALUES ('Ittiba Reconnect Surabaya 2026', '2026-07-13'::date, 'Grand City Surabaya', 'STAGE', '', 'ittiba-reconnect-sby')
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO new_event_id;

  IF new_event_id IS NOT NULL THEN
    INSERT INTO layouts (gender, label, rows, cols, col_start_char, reverse_col, event_id)
    VALUES ('male', 'Pria', 50, 15, 'A', false, new_event_id)
    ON CONFLICT (event_id, gender) DO NOTHING;

    INSERT INTO layouts (gender, label, rows, cols, col_start_char, reverse_col, event_id)
    VALUES ('female', 'Wanita', 50, 25, 'A', true, new_event_id)
    ON CONFLICT (event_id, gender) DO NOTHING;
  END IF;
END $$;