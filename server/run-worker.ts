import { createKafka, createOpenSearchClient, createPostgresPool, ServiceConfigurationError } from "./connections.ts";
import { createDatabase } from "./db/database.ts";
import { createCommerceProjectionWriter } from "./discovery/commerce-projection-writer.ts";
import { required } from "./service-config.ts";
import { runWorker } from "./worker.ts";

const stop = new AbortController();
const onSignal = () => stop.abort();
process.once("SIGINT", onSignal);
process.once("SIGTERM", onSignal);
try {
  const index = required(process.env, "OPENSEARCH_INDEX");
  const kafka = createKafka();
  const pool = createPostgresPool();
  try {
    const db = createDatabase(pool, process.env.ST_DB_SCHEMA ?? "");
    const client = createOpenSearchClient();
    try {
      if (!(await client.indices.exists({ index })).body) {
        throw new ServiceConfigurationError("Set up the approved OpenSearch index before starting the worker");
      }
      await runWorker({
        db, kafka, writeProjection: createCommerceProjectionWriter(client, index),
        topic: process.env.KAFKA_TOPIC ?? "", groupId: process.env.KAFKA_GROUP_ID ?? "", signal: stop.signal,
      });
    } finally {
      await client.close();
    }
  } finally {
    await pool.end();
  }
} catch (error) {
  if (error !== stop.signal.reason) {
    console.error(error instanceof ServiceConfigurationError ? error.message : "SmartTijori worker failed; check service, schema, topic and writer configuration.");
    process.exitCode = 1;
  }
} finally {
  process.removeListener("SIGINT", onSignal);
  process.removeListener("SIGTERM", onSignal);
}
