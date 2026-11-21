import {
  createKafka,
  createOpenSearchClient,
  createPostgresPool,
  ServiceConfigurationError,
} from "./connections.ts";

const checks = [
  ["PostgreSQL", async () => {
    const pool = createPostgresPool();
    try {
      await pool.query("SELECT 1");
    } finally {
      await pool.end();
    }
  }],
  ["Kafka", async () => {
    const admin = createKafka().admin();
    try {
      await admin.connect();
      await admin.listTopics({ timeout: 10_000 });
    } finally {
      await admin.disconnect();
    }
  }],
  ["OpenSearch", async () => {
    const client = createOpenSearchClient();
    try {
      await client.info();
    } finally {
      await client.close();
    }
  }],
];

await Promise.all(checks.map(async ([name, check]) => {
  try {
    await check();
    console.log(`${name}: authenticated read-only check passed`);
  } catch (error) {
    const detail = error instanceof ServiceConfigurationError
      ? error.message
      : "connection failed; check credentials, certificates and network access";
    console.error(`${name}: ${detail}`);
    process.exitCode = 1;
  }
}));
