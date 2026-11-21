import "server-only";
import type { Pool, PoolClient } from "pg";

export interface Database {
  transact<T>(run: (client: PoolClient) => Promise<T>): Promise<T>;
}

export function createDatabase(pool: Pool, schema: string): Database {
  if (!/^st_[a-z][a-z0-9_]{0,47}$/.test(schema)) {
    throw new Error("Set an explicit SmartTijori schema starting with st_");
  }

  return {
    async transact(run) {
      const client = await pool.connect();
      let discard = false;
      try {
        await client.query(`BEGIN;
          SET LOCAL search_path TO "${schema}";
          SET LOCAL lock_timeout = '2s';
          SET LOCAL statement_timeout = '8s'`);
        const result = await run(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          discard = true;
        }
        throw error;
      } finally {
        client.release(discard);
      }
    },
  };
}
