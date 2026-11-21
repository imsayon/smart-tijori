import type { Pool, QueryResult } from "pg";
import type { ProductOffer, Pack } from "../contracts/catalog";
import type { ProductFactsReader } from "../contracts/facts";

let cachedPool: Pool | null = null;

export async function getOrCreatePool(injectedPool?: Pool): Promise<Pool> {
  if (injectedPool) return injectedPool;
  if (!cachedPool) {
    try {
      // In Next.js Server Components / Route Handlers with react-server condition
      const { createPostgresPool } = await import("../connections");
      cachedPool = createPostgresPool();
    } catch {
      // In standalone Node/tsx test runners where server-only triggers, reuse exact config
      const { readFileSync } = await import("node:fs");
      const { resolve } = await import("node:path");
      const { Pool } = await import("pg");

      const rawUrl = process.env.DATABASE_URL;
      if (!rawUrl) throw new Error("Missing DATABASE_URL");
      const url = new URL(rawUrl);
      for (const name of [
        "ssl",
        "sslmode",
        "sslcert",
        "sslkey",
        "sslrootcert",
        "sslpassword",
        "sslnegotiation",
      ]) {
        url.searchParams.delete(name);
      }

      let ca: string | undefined = undefined;
      const caPath = process.env.DATABASE_CA_CERT_PATH;
      if (caPath) {
        try {
          ca = readFileSync(caPath, "utf8");
        } catch {
          try {
            ca = readFileSync(resolve(process.cwd(), caPath), "utf8");
          } catch {
            // Leave undefined if unreadable
          }
        }
      }

      cachedPool = new Pool({
        connectionString: url.toString(),
        ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
        max: 2,
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
      });
      cachedPool.on("error", () => console.error("PostgreSQL idle connection failed"));
    }
  }
  return cachedPool;
}

export function parsePack(name: string, attrs: Record<string, unknown>): Pack {
  const match = name.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml|count|units?|tablets?|capsules?|wash)\b/i);
  if (match) {
    const qty = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    return { quantity: qty, unit };
  }
  if (typeof attrs.packQuantity === "number" && typeof attrs.packUnit === "string") {
    return { quantity: attrs.packQuantity, unit: attrs.packUnit };
  }
  return { quantity: 1, unit: "count" };
}

export function mapRowToProductOffer(
  row: Record<string, unknown>,
  requestedStoreId: string
): ProductOffer {
  const attributes =
    typeof row.attributes === "object" && row.attributes !== null
      ? (row.attributes as Record<string, unknown>)
      : {};
  const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];

  const bookStock = Number(row.book_stock ?? 0);
  const reservedStock = Number(row.reserved_stock ?? 0);
  // Availability rule: book_stock - reserved_stock > 0
  const availableStock = bookStock - reservedStock;
  const isAvailable = availableStock > 0;

  const sku = typeof row.sku === "string" ? row.sku : String(row.product_id);
  const name = String(row.product_name ?? row.name ?? "");
  const category = String(row.category ?? "General");
  const family = typeof attributes.family === "string" ? attributes.family : "";
  const purpose = family
    ? family.toLowerCase().replace(/\s+/g, "-")
    : category.toLowerCase().replace(/\s+/g, "-");

  const knownAttributes: Record<string, string | number | boolean | string[]> = {
    brand: String(row.brand ?? ""),
    sku,
    bookStock,
    reservedStock,
    availableStock,
    ...(attributes as Record<string, string | number | boolean | string[]>),
  };
  if (tags.length > 0) {
    knownAttributes.tags = tags;
  }

  const checkedAt = row.updated_at
    ? new Date(row.updated_at as string | Date).toISOString()
    : new Date().toISOString();

  return {
    productId: String(row.product_id),
    storeId: requestedStoreId,
    city: String(row.city ?? "Bengaluru"),
    name,
    category,
    purpose,
    description: row.description ? String(row.description) : undefined,
    pricePaise: Number(row.price_paise ?? 0),
    imageUrl: `/images/products/${sku.toLowerCase()}.webp`,
    pack: parsePack(name, attributes),
    knownAttributes,
    available: isAvailable,
    inventoryVersion: Number(row.inventory_version ?? 1),
    checkedAt,
  };
}

/**
 * PostgreSQL-backed implementation of ProductFactsReader.
 * Reads real-time product master, pricing, and stock facts from Aiven PostgreSQL.
 */
export class PostgresProductFactsReader implements ProductFactsReader {
  private readonly injectedPool?: Pool;
  private readonly fallbackReader?: ProductFactsReader;

  constructor(pool?: Pool, fallbackReader?: ProductFactsReader) {
    this.injectedPool = pool;
    this.fallbackReader = fallbackReader;
  }

  async readProductFacts(storeId: string, productIds: string[]): Promise<ProductOffer[]> {
    if (!productIds || productIds.length === 0) {
      return [];
    }

    const query = `
      SELECT
        s.id AS store_id,
        p.id AS product_id,
        p.sku,
        s.name AS store_name,
        s.city,
        p.name AS product_name,
        p.brand,
        p.category,
        p.description,
        p.attributes,
        p.tags,
        o.price_paise,
        o.mrp_paise,
        o.book_stock,
        o.reserved_stock,
        (o.book_stock - o.reserved_stock) AS available_stock,
        o.inventory_version,
        o.updated_at
      FROM st_platform_verify_v1.demo_offers o
      JOIN st_platform_verify_v1.demo_stores s ON s.id = o.store_id
      JOIN st_platform_verify_v1.demo_products p ON p.id = o.product_id
      WHERE (
          s.id::text = $1
          OR ($1 = 'blr-01' AND s.id = 2)
          OR ($1 = 'mys-01' AND s.id = 1)
        )
        AND (
          p.id::text = ANY($2::text[])
          OR p.sku = ANY($2::text[])
        );
    `;

    let result: QueryResult | null = null;
    try {
      const pool = await getOrCreatePool(this.injectedPool);
      result = await pool.query(query, [storeId, productIds]);
    } catch (dbErr) {
      if (this.fallbackReader) {
        return this.fallbackReader.readProductFacts(storeId, productIds);
      }
      throw dbErr;
    }

    const byDbId = new Map<string, ProductOffer>();
    const bySku = new Map<string, ProductOffer>();

    for (const row of result.rows) {
      const offer = mapRowToProductOffer(row, storeId);
      byDbId.set(String(row.product_id), offer);
      if (typeof row.sku === "string") {
        bySku.set(row.sku, offer);
      }
    }

    const matchedOffers: ProductOffer[] = [];
    const missingPids: string[] = [];

    for (const requestedPid of productIds) {
      const matched = byDbId.get(requestedPid) || bySku.get(requestedPid);
      if (matched) {
        matchedOffers.push({
          ...matched,
          productId: requestedPid,
        });
      } else {
        missingPids.push(requestedPid);
      }
    }

    // If a fallbackReader is provided (e.g. for fixture items not stored in DB), consult it
    if (missingPids.length > 0 && this.fallbackReader) {
      try {
        const fallbackOffers = await this.fallbackReader.readProductFacts(storeId, missingPids);
        matchedOffers.push(...fallbackOffers);
      } catch {
        // Missing products are omitted from the returned array per contract
      }
    }

    return matchedOffers;
  }
}
