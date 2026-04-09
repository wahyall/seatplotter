ALTER TABLE seats ADD COLUMN IF NOT EXISTS is_goodie_bag boolean NOT NULL DEFAULT false;
ALTER TABLE seats ADD COLUMN IF NOT EXISTS goodie_bag_at timestamptz;
