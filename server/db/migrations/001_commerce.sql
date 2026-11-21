CREATE TABLE stores (
  id text PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL
);

CREATE TABLE products (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  purpose text NOT NULL,
  price_paise integer NOT NULL CHECK (price_paise BETWEEN 1 AND 500000),
  image_url text,
  pack_quantity integer NOT NULL CHECK (pack_quantity > 0),
  pack_unit text NOT NULL CHECK (pack_unit IN ('g', 'ml', 'count')),
  attributes jsonb NOT NULL CHECK (jsonb_typeof(attributes) = 'object')
);

CREATE TABLE inventory (
  store_id text REFERENCES stores,
  product_id text REFERENCES products,
  stock_on_hand integer NOT NULL CHECK (stock_on_hand BETWEEN 0 AND 1000000),
  inventory_version integer NOT NULL DEFAULT 1 CHECK (inventory_version > 0),
  PRIMARY KEY (store_id, product_id)
);

CREATE TABLE carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL UNIQUE,
  store_id text REFERENCES stores
);

CREATE TABLE cart_lines (
  cart_id uuid REFERENCES carts,
  product_id text REFERENCES products,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  PRIMARY KEY (cart_id, product_id)
);

CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES carts,
  store_id text NOT NULL REFERENCES stores,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED')),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at = created_at + interval '5 minutes'),
  total_paise integer NOT NULL CHECK (total_paise > 0)
);

CREATE UNIQUE INDEX reservations_active_cart ON reservations (cart_id) WHERE status = 'ACTIVE';
CREATE INDEX reservations_due ON reservations (expires_at, id) WHERE status = 'ACTIVE';
CREATE INDEX reservations_active_store ON reservations (store_id, expires_at) WHERE status = 'ACTIVE';

CREATE TABLE reservation_lines (
  reservation_id uuid REFERENCES reservations,
  product_id text REFERENCES products,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  name text NOT NULL,
  unit_price_paise integer NOT NULL CHECK (unit_price_paise BETWEEN 1 AND 500000),
  PRIMARY KEY (reservation_id, product_id)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL UNIQUE REFERENCES reservations,
  created_at timestamptz NOT NULL,
  total_paise integer NOT NULL CHECK (total_paise > 0),
  payment_mode text NOT NULL CHECK (payment_mode = 'SIMULATED')
);

CREATE TABLE order_lines (
  order_id uuid REFERENCES orders,
  product_id text REFERENCES products,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  name text NOT NULL,
  unit_price_paise integer NOT NULL CHECK (unit_price_paise BETWEEN 1 AND 500000),
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE idempotency (
  actor_kind text CHECK (actor_kind IN ('shopper', 'operator')),
  actor_id text,
  operation text,
  key text,
  fingerprint text NOT NULL,
  result jsonb,
  PRIMARY KEY (actor_kind, actor_id, operation, key)
);

CREATE TABLE stock_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id text NOT NULL,
  product_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ORDER', 'POS', 'RESTOCK')),
  reference_id uuid NOT NULL,
  quantity_delta integer NOT NULL CHECK (
    (kind = 'RESTOCK' AND quantity_delta BETWEEN 1 AND 1000)
    OR (kind IN ('ORDER', 'POS') AND quantity_delta BETWEEN -99 AND -1)
  ),
  occurred_at timestamptz NOT NULL,
  FOREIGN KEY (store_id, product_id) REFERENCES inventory,
  UNIQUE (kind, reference_id, product_id)
);

CREATE INDEX movements_recent ON stock_movements (store_id, occurred_at DESC, id DESC);

CREATE TABLE stock_interest (
  actor_id text,
  store_id text,
  product_id text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (store_id, product_id) REFERENCES inventory,
  PRIMARY KEY (actor_id, store_id, product_id)
);

CREATE TABLE outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('inventory.changed', 'order.placed')),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  store_id text NOT NULL REFERENCES stores,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (payload ? 'storeId' AND payload->>'storeId' = store_id),
  published_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  retry_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_error text,
  last_error_at timestamptz,
  CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
  CHECK (published_at IS NULL OR lease_token IS NULL)
);

CREATE INDEX outbox_pending ON outbox (retry_at, occurred_at, id) WHERE published_at IS NULL;
CREATE INDEX outbox_recent ON outbox (store_id, occurred_at DESC, id DESC);
