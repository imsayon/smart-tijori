ALTER TABLE orders DROP CONSTRAINT orders_payment_mode_check;
ALTER TABLE orders ADD CHECK (payment_mode IN ('SIMULATED', 'RAZORPAY'));

CREATE TABLE payment_attempts (
  reservation_id uuid PRIMARY KEY REFERENCES reservations,
  owner_id text NOT NULL,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  provider_order_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  next_check_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_checked_at timestamptz,
  provider_pending boolean NOT NULL DEFAULT true
);
CREATE INDEX payment_attempts_owner ON payment_attempts (owner_id, created_at DESC);
CREATE INDEX payment_attempts_due ON payment_attempts (next_check_at) WHERE provider_order_id IS NOT NULL;

CREATE TABLE payment_captures (
  provider_payment_id text PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES payment_attempts,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  order_id uuid UNIQUE REFERENCES orders,
  refund_id text UNIQUE,
  refund_status text CHECK (refund_status IN ('pending', 'processed', 'failed')),
  CHECK ((order_id IS NOT NULL) <> (refund_status IS NOT NULL))
);
CREATE INDEX payment_captures_reservation ON payment_captures (reservation_id);
