import { createCommerceFacts } from "../server/commerce/facts";
import { createDatabase } from "../server/db/database";
import { createPostgresPool } from "../server/db/pool";
import { setupProductIndex } from "../server/discovery/index-definition";
import { getOpenSearchClient } from "../server/discovery/opensearch-client";
import { createCommerceProjectionWriter } from "../server/discovery/commerce-projection-writer";
import { rebuildStoreProjection } from "../server/events/project";

async function main() {
  const storeIds = [...new Set(process.argv.slice(2))];
  const index = process.env.OPENSEARCH_INDEX;
  if (!index || storeIds.length === 0) {
    console.error("Set OPENSEARCH_INDEX explicitly and pass the approved store IDs.");
    process.exitCode = 1;
    return;
  }

  const pool = createPostgresPool();
  try {
    const db = createDatabase(pool, process.env.ST_DB_SCHEMA ?? "");
    const { rowCount } = await db.transact(client =>
      client.query("SELECT id FROM stores WHERE id = ANY($1::text[])", [storeIds]));
    if (rowCount !== storeIds.length) throw new Error("Unknown store");

    const client = getOpenSearchClient();
    try {
      await setupProductIndex(client, index);
      const writer = createCommerceProjectionWriter(client, index);
      for (const storeId of storeIds) {
        const count = await rebuildStoreProjection(db, createCommerceFacts(db), writer, storeId);
        console.log(`${storeId}: processed ${count} offers`);
      }
      await client.indices.refresh({ index });
    } finally {
      await client.close();
    }
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error("Catalog sync failed. Check service configuration and target permissions before retrying.");
  process.exitCode = 1;
});
