CREATE TABLE IF NOT EXISTS participants (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nama        text,
  email       text,
  jenis_kelamin text,
  telepon     text,
  tiket       text,
  kode_tiket  text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_participants_kode_tiket ON participants (kode_tiket);
CREATE INDEX IF NOT EXISTS idx_participants_tiket ON participants (tiket);
