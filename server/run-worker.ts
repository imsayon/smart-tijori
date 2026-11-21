import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createKafka, createPostgresPool, ServiceConfigurationError } from "./connections.ts";
import type { WriteProjection } from "./contracts/events.ts";
import { createDatabase } from "./db/database.ts";
import { runWorker } from "./worker.ts";

interface WriterResource {
  writeProjection: WriteProjection;
  close(): Promise<void>;
}

const stop = new AbortController();
const onSignal = () => stop.abort();
process.once("SIGINT", onSignal);
process.once("SIGTERM", onSignal);
try {
  const modulePath = process.env.ST_PROJECTION_WRITER_MODULE;
  if (!modulePath) throw new ServiceConfigurationError("Set ST_PROJECTION_WRITER_MODULE to the real discovery adapter");
  const adapter = await import(pathToFileURL(resolve(modulePath)).href) as {
    createProjectionWriter?: () => WriterResource | Promise<WriterResource>;
  };
  if (typeof adapter.createProjectionWriter !== "function") {
    throw new ServiceConfigurationError("The discovery adapter must export createProjectionWriter");
  }
  const kafka = createKafka();
  const pool = createPostgresPool();
  try {
    const db = createDatabase(pool, process.env.ST_DB_SCHEMA ?? "");
    const writer = await adapter.createProjectionWriter();
    try {
      await runWorker({
        db, kafka, writeProjection: (offers, signal) => writer.writeProjection(offers, signal),
        topic: process.env.KAFKA_TOPIC ?? "", groupId: process.env.KAFKA_GROUP_ID ?? "", signal: stop.signal,
      });
    } finally {
      await writer.close();
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
