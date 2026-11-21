-- New checkout reservations use the promised five-minute CartLock window.
-- Preserve existing 59-second rows and their original expiration times.
ALTER TABLE reservations ALTER COLUMN duration_seconds SET DEFAULT 300;
