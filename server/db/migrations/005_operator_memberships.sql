CREATE TABLE operator_memberships (
  firebase_uid text PRIMARY KEY,
  store_id text NOT NULL REFERENCES stores,
  active boolean NOT NULL DEFAULT true
);
