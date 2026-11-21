import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Client } from "pg";
import { features } from "@confluentinc/kafka-javascript";
import { createCommerceProjectionWriter } from "../server/discovery/commerce-projection-writer.ts";
import {
  createKafka,
  createOpenSearchClient,
  createPostgresPool,
  ServiceConfigurationError,
} from "../server/connections.ts";

test("the native Kafka client supports TLS", () => {
  assert.ok(features.includes("ssl"));
});

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

test("commerce writer keeps incomplete and failed OpenSearch requests retryable", async () => {
  const offers = ["applied", "duplicate", "server-error", "invalid", "missing"].map(productId => ({
    storeId: "blr-01", productId, name: productId, pricePaise: 500,
    available: 1, attributes: {}, inventoryVersion: 1,
  }));
  const client = {
    async bulk({ body }) {
      assert.equal(body[0].index._index, "disposable");
      assert.equal(body[0].index.version_type, "external");
      assert.equal(body[1].availableStock, 1);
      return { body: { items: [201, 409, 500, 400].map(status => ({ index: { status } })) } };
    },
  };
  const writer = createCommerceProjectionWriter(client, "disposable");
  assert.deepEqual(await writer(offers), [
    { documentId: "blr-01:applied", status: "applied" },
    { documentId: "blr-01:duplicate", status: "unchanged" },
    { documentId: "blr-01:server-error", status: "failed", retryable: true },
    { documentId: "blr-01:invalid", status: "failed", retryable: false },
    { documentId: "blr-01:missing", status: "failed", retryable: true },
  ]);

  const broken = createCommerceProjectionWriter({
    async bulk() { throw new Error("index unavailable"); },
  }, "disposable");
  assert.deepEqual(await broken(offers.slice(0, 1)), [
    { documentId: "blr-01:applied", status: "failed", retryable: true },
  ]);
});
