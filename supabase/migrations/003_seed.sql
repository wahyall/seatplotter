-- cols must be 1–52 (A–Z then AA–AZ). col_start + cols cannot exceed 52 columns from A.
INSERT INTO config (event_name, event_date, event_venue, stage_label)
SELECT 'Ittiba Disconnect Surabaya 2026', '2026-06-07'::date, 'Westin Surabaya', 'STAGE'
WHERE NOT EXISTS (SELECT 1 FROM config LIMIT 1);

INSERT INTO layouts (gender, label, rows, cols, col_start_char, reverse_col)
VALUES ('male', 'Pria', 50, 15, 'A', false)
ON CONFLICT (gender) DO UPDATE SET
  label = EXCLUDED.label,
  rows  = EXCLUDED.rows,
  cols  = EXCLUDED.cols,
  col_start_char = EXCLUDED.col_start_char,
  reverse_col    = EXCLUDED.reverse_col,
  updated_at     = now();

INSERT INTO layouts (gender, label, rows, cols, col_start_char, reverse_col)
VALUES ('female', 'Wanita', 50, 25, 'A', true)
ON CONFLICT (gender) DO UPDATE SET
  label = EXCLUDED.label,
  rows  = EXCLUDED.rows,
  cols  = EXCLUDED.cols,
  col_start_char = EXCLUDED.col_start_char,
  reverse_col    = EXCLUDED.reverse_col,
  updated_at     = now();
