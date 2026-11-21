CREATE TABLE projection_quarantine (
  topic text,
  partition integer,
  message_offset bigint,
  event_id uuid,
  store_id text,
  raw_value bytea,
  raw_key bytea,
  reason text NOT NULL,
  quarantined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (topic, partition, message_offset)
);

CREATE TABLE projection_progress (
  store_id text PRIMARY KEY REFERENCES stores,
  last_accepted_at timestamptz NOT NULL
);

CREATE TABLE projection_retry (
  topic text,
  partition integer,
  message_offset bigint,
  store_id text NOT NULL REFERENCES stores,
  reason text NOT NULL,
  failed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (topic, partition, message_offset)
);

CREATE INDEX projection_retry_store ON projection_retry (store_id);
