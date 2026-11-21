-- Preserve the promised deadline on holds created before this migration.
ALTER TABLE reservations ADD COLUMN duration_seconds integer NOT NULL DEFAULT 300;
ALTER TABLE reservations ALTER COLUMN duration_seconds SET DEFAULT 59;
ALTER TABLE reservations DROP CONSTRAINT reservations_check;
ALTER TABLE reservations ADD CHECK (duration_seconds IN (59, 300)
  AND expires_at = created_at + make_interval(secs => duration_seconds));
