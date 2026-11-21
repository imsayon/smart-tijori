import "server-only";
import type { PoolClient } from "pg";
import type { LineInput, ProductOffer, StockMovement } from "../contracts/commerce.ts";

interface InventoryRow extends Omit<ProductOffer, "checkedAt"> {
  stockOnHand: number;
  held: number;
}

export async function databaseTime(client: PoolClient): Promise<Date> {
  const { rows } = await client.query<{ now: Date }>("SELECT date_trunc('milliseconds', clock_timestamp()) AS now");
  return rows[0].now;
}

export async function lockInventory(client: PoolClient, storeId: string, productIds: readonly string[]) {
  await client.query(`
    SELECT product_id FROM inventory
    WHERE store_id = $1 AND product_id = ANY($2::text[])
    ORDER BY product_id COLLATE "C" FOR UPDATE`, [storeId, productIds]);
}

export async function inventoryFacts(
  client: PoolClient, storeId: string, productIds: readonly string[] | null, now: Date,
): Promise<InventoryRow[]> {
  const { rows } = await client.query<InventoryRow>(`
    SELECT p.id AS "productId", s.id AS "storeId", s.city, p.name, p.category, p.purpose,
      p.price_paise AS "pricePaise", p.image_url AS "imageUrl",
      jsonb_build_object('quantity', p.pack_quantity, 'unit', p.pack_unit) AS pack, p.attributes,
      i.stock_on_hand AS "stockOnHand", h.held, i.stock_on_hand - h.held AS available,
      i.inventory_version AS "inventoryVersion"
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    JOIN stores s ON s.id = i.store_id
    CROSS JOIN LATERAL (
      SELECT coalesce(sum(l.quantity), 0)::integer AS held
      FROM reservations r JOIN reservation_lines l ON l.reservation_id = r.id
      WHERE r.store_id = i.store_id AND l.product_id = i.product_id
        AND r.status = 'ACTIVE' AND r.expires_at > $3
    ) h
    WHERE i.store_id = $1 AND ($2::text[] IS NULL OR p.id = ANY($2))
    ORDER BY p.id COLLATE "C" LIMIT 100`, [storeId, productIds, now]);
  return rows;
}

export function offer(row: InventoryRow, now: Date): ProductOffer {
  const { stockOnHand, held, ...facts } = row;
  void stockOnHand;
  void held;
  return { ...facts, checkedAt: now.toISOString() };
}

// Call after locking every affected SKU. Versions and events share the business transaction.
export async function advanceVersions(client: PoolClient, storeId: string, productIds: string[], now: Date) {
  await client.query(`
    WITH changed AS (
      UPDATE inventory SET inventory_version = inventory_version + 1
      WHERE store_id = $1 AND product_id = ANY($2::text[])
      RETURNING product_id, inventory_version
    )
    INSERT INTO outbox (type, store_id, occurred_at, payload)
    SELECT 'inventory.changed', $1, $3,
      jsonb_build_object('storeId', $1::text, 'productId', product_id, 'inventoryVersion', inventory_version)
    FROM changed`, [storeId, productIds, now]);
}

export async function moveStock(
  client: PoolClient, storeId: string, kind: StockMovement["kind"],
  referenceId: string, lines: readonly LineInput[], now: Date,
) {
  const delta = kind === "RESTOCK" ? 1 : -1;
  await client.query(`
    WITH input AS (
      SELECT product_id, quantity * $6::integer AS delta
      FROM unnest($4::text[], $5::integer[]) AS line(product_id, quantity)
    ), changed AS (
      UPDATE inventory i SET stock_on_hand = i.stock_on_hand + input.delta
      FROM input WHERE i.store_id = $1 AND i.product_id = input.product_id
      RETURNING i.product_id, input.delta
    )
    INSERT INTO stock_movements (store_id, product_id, kind, reference_id, quantity_delta, occurred_at)
    SELECT $1, product_id, $2, $3, delta, $7 FROM changed`,
  [storeId, kind, referenceId, lines.map((line) => line.productId), lines.map((line) => line.quantity), delta, now]);
  await advanceVersions(client, storeId, lines.map((line) => line.productId), now);
}
