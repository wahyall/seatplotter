-- Allow up to 100 rows (UI slider); was capped at 50 in 001_create_tables.sql
ALTER TABLE layouts DROP CONSTRAINT IF EXISTS layouts_rows_check;
ALTER TABLE layouts
  ADD CONSTRAINT layouts_rows_check CHECK (rows >= 1 AND rows <= 100);
