-- Link seats ↔ participants for self-service booking.
-- Using a UNIQUE constraint on participant_id to prevent double-booking (race condition guard).

ALTER TABLE seats ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES participants(id) ON DELETE SET NULL;

-- Each participant can only occupy ONE seat (prevents race condition where two
-- concurrent requests try to book different seats for the same participant).
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_participant_unique
  ON seats (participant_id) WHERE participant_id IS NOT NULL;

-- Reverse lookup: which seat does this participant have?
ALTER TABLE participants ADD COLUMN IF NOT EXISTS seat_id uuid REFERENCES seats(id) ON DELETE SET NULL;

-- Each seat can only be booked by ONE participant
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_seat_unique
  ON participants (seat_id) WHERE seat_id IS NOT NULL;
