import "server-only";
import type { CommerceFacts, StockMovement } from "../contracts/commerce.ts";
import type { Database } from "../db/database.ts";
import { databaseTime, inventoryFacts, offer } from "./inventory.ts";

export function createCommerceFacts(db: Database): CommerceFacts {
  return {
    readProductFacts(storeId, productIds) {
      if (productIds.length > 100) throw new RangeError("At most 100 product IDs per facts batch");
      return db.transact(async (client) => {
        await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const now = await databaseTime(client);
        return (await inventoryFacts(client, storeId, productIds, now)).map((row) => offer(row, now));
      });
    },
    readOpsFacts(storeId) {
      return db.transact(async (client) => {
        await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const now = await databaseTime(client);
        const stock = (await inventoryFacts(client, storeId, null, now)).map((row) => ({
          productId: row.productId,
          stockOnHand: row.stockOnHand,
          held: row.held,
          available: row.available,
          inventoryVersion: row.inventoryVersion,
        }));
        const { rows } = await client.query<Omit<StockMovement, "occurredAt"> & { occurredAt: Date }>(`
          SELECT product_id AS "productId", kind, reference_id AS "referenceId",
            quantity_delta AS "quantityDelta", occurred_at AS "occurredAt"
          FROM stock_movements WHERE store_id = $1 ORDER BY occurred_at DESC, id DESC LIMIT 20`, [storeId]);
        return { storeId, checkedAt: now.toISOString(), stock,
          recentMovements: rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })) };
      });
    },
  };
}
