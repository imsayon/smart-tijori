import { createPostgresPool, ServiceConfigurationError } from "../connections.ts";
import { migrate } from "./migrate.ts";

try {
  const options = process.argv.slice(2);
  if (options.length && (options.length !== 1 || options[0] !== "--seed")) {
    throw new ServiceConfigurationError("Use db:migrate with an optional --seed");
  }
  const pool = createPostgresPool();
  try {
    await migrate(pool, process.env.ST_DB_SCHEMA ?? "", options.length === 1);
    console.log("SmartTijori migrations applied");
  } finally {
    await pool.end();
  }
} catch (error) {
  console.error(error instanceof ServiceConfigurationError ? error.message : "SmartTijori migration failed. Check the schema name and database permissions.");
  process.exitCode = 1;
}
