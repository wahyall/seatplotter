-- Primary brand color per event (hex or CSS color string consumed by the app)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#6366f1';

UPDATE events SET color = '#6366f1' WHERE color IS NULL OR trim(color) = '';
