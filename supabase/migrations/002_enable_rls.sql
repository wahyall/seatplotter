ALTER TABLE config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE layouts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_all" ON config
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_public_all" ON layouts
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_public_all" ON categories
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_public_all" ON seats
  FOR ALL TO anon USING (true) WITH CHECK (true);
