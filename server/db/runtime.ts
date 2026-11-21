import "server-only";
import { createDatabase, type Database } from "./database.ts";
import { createPostgresPool } from "./pool.ts";

let database: Database | undefined;

export function getCommerceDatabase(): Database {
  return database ??= createDatabase(createPostgresPool(), process.env.ST_DB_SCHEMA ?? "");
}
