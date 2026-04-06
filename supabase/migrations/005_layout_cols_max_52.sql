-- Up to 52 columns (A–Z, then AA–AZ); was capped at 26 in 001_create_tables.sql
ALTER TABLE layouts DROP CONSTRAINT IF EXISTS layouts_cols_check;
ALTER TABLE layouts
  ADD CONSTRAINT layouts_cols_check CHECK (cols >= 1 AND cols <= 52);
