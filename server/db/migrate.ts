import "server-only";
import { readFile } from "node:fs/promises";
import type { Pool } from "pg";
import { createDatabase } from "./database.ts";

const migrations = ["001_commerce.sql", "002_delivery.sql", "003_cartlock.sql", "004_pos_barcode.sql", "005_operator_memberships.sql", "006_payments.sql", "007_five_minute_holds.sql"];

export async function migrate(pool: Pool, schema: string, seed = false): Promise<void> {
  const db = createDatabase(pool, schema);
  await db.transact(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [schema]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await client.query("CREATE TABLE IF NOT EXISTS migrations (id text PRIMARY KEY)");
    for (const id of migrations) {
      const { rowCount } = await client.query("SELECT 1 FROM migrations WHERE id = $1", [id]);
      if (rowCount) continue;
      await client.query(await readFile(new URL(`./migrations/${id}`, import.meta.url), "utf8"));
      await client.query("INSERT INTO migrations (id) VALUES ($1)", [id]);
    }
    if (seed) {
      await client.query(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
    }
  });
}
