CREATE TABLE product_barcodes (
  barcode text PRIMARY KEY CHECK (barcode ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
  product_id text NOT NULL REFERENCES products,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE pos_sales (
  id uuid PRIMARY KEY,
  store_id text NOT NULL REFERENCES stores,
  operator_id text NOT NULL,
  sold_at timestamptz NOT NULL,
  total_paise integer NOT NULL CHECK (total_paise > 0),
  lines jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array' AND jsonb_array_length(lines) > 0)
);
