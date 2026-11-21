import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Client } from "pg";
import {
  createKafka,
  createOpenSearchClient,
  createPostgresPool,
  ServiceConfigurationError,
} from "../server/connections.ts";

test("service configuration is validated only when a client is requested", () => {
  for (const create of [createPostgresPool, createKafka, createOpenSearchClient])
    assert.throws(() => create({}), ServiceConfigurationError);
});

test("PostgreSQL URLs cannot override certificate verification or the supplied CA", async () => {
  const directory = mkdtempSync(join(tmpdir(), "smart-tijori-tls-"));
  const caPath = join(directory, "ca.pem");
  writeFileSync(caPath, "test CA");
  try {
    for (const query of [
      "sslmode=no-verify&sslrootcert=untrusted&sslcert=other&sslkey=other&sslpassword=other",
      "ssl=no-verify",
      "ssl=0",
      "sslnegotiation=direct",
    ]) {
      const pool = createPostgresPool({
        DATABASE_URL: `postgres://test:secret@localhost/db?${query}`,
        DATABASE_CA_CERT_PATH: caPath,
      });
      const client = new Client(pool.options);
      assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
      assert.equal(client.connectionParameters.ssl.ca, "test CA");
      assert.equal(new URL(pool.options.connectionString).search, "");
      assert.equal(pool.options.max, 2);
      await pool.end();
    }
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("Kafka rejects plaintext, credentials in broker URLs and unsafe protocols", () => {
  for (const broker of ["https://broker:9092", "user:secret@broker:9092", "broker", "broker:9092/path", "broker:9092,"])
    assert.throws(() => createKafka({ KAFKA_BROKERS: broker }), /Invalid KAFKA_BROKERS/);
  assert.throws(() => createKafka({ KAFKA_BROKERS: "broker:9092", KAFKA_SECURITY_PROTOCOL: "PLAINTEXT" }), /Invalid KAFKA_SECURITY_PROTOCOL/);
});

test("OpenSearch rejects HTTP and embedded credentials without exposing their value", () => {
  for (const url of ["http://localhost:9200", "https://user:secret@localhost:9200", "https://localhost:9200/?password=secret"])
    assert.throws(() => createOpenSearchClient({ OPENSEARCH_URL: url }), (error) =>
      error instanceof ServiceConfigurationError && !error.message.includes("secret"));
});
