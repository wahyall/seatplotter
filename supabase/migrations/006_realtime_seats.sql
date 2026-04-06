-- Broadcast seat row updates (e.g. check-in) to Realtime subscribers.
-- Required for postgres_changes on `seats`; safe to run once per project.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'seats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE seats;
  END IF;
END $$;
