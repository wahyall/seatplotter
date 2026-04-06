CREATE TABLE IF NOT EXISTS config (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name  text        NOT NULL DEFAULT 'Event Saya',
  event_date  date,
  event_venue text        DEFAULT '',
  stage_label text        NOT NULL DEFAULT 'STAGE',
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS layouts (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  gender         text        NOT NULL UNIQUE CHECK (gender IN ('male', 'female')),
  label          text        NOT NULL,
  rows           int         NOT NULL DEFAULT 10 CHECK (rows BETWEEN 1 AND 50),
  cols           int         NOT NULL DEFAULT 10 CHECK (cols BETWEEN 1 AND 26),
  col_start_char char(1)     NOT NULL DEFAULT 'A',
  reverse_col    boolean     NOT NULL DEFAULT false,
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  layout_id uuid NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  name      text NOT NULL,
  color     text NOT NULL DEFAULT '#6366F1',
  "order"   int  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS seats (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  layout_id   uuid        NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  row         int         NOT NULL,
  col         int         NOT NULL,
  label       text        NOT NULL,
  category_id uuid        REFERENCES categories(id) ON DELETE SET NULL,
  is_empty    boolean     NOT NULL DEFAULT false,
  is_checked  boolean     NOT NULL DEFAULT false,
  checked_at  timestamptz,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (layout_id, row, col)
);

CREATE INDEX IF NOT EXISTS idx_seats_layout   ON seats (layout_id);
CREATE INDEX IF NOT EXISTS idx_seats_checked  ON seats (layout_id, is_checked);
CREATE INDEX IF NOT EXISTS idx_seats_row_col  ON seats (layout_id, row, col);
