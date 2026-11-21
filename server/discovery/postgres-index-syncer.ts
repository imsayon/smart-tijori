import type { Client } from "@opensearch-project/opensearch";
import type { Pool } from "pg";
import type { ProductOffer } from "../contracts/catalog";
import type { ProjectionResult } from "../contracts/discovery";
import { getOpenSearchClient, getOpenSearchConfig } from "./opensearch-client";
import { setupProductIndex } from "./index-definition";
import { writeProjection } from "./projection-writer";
import {
  mapRowToProductOffer,
  getOrCreatePool,
} from "./postgres-product-facts-reader";

export interface SyncOptions {
  pool?: Pool;
  client?: Client;
  index?: string;
  batchSize?: number;
  limit?: number;
  storeId?: number | string;
  productId?: number | string;
  refresh?: boolean | "wait_for";
  onProgress?: (progress: {
    processed: number;
    total: number;
    applied: number;
    unchanged: number;
    failed: number;
  }) => void;
}

export interface SyncResult {
  totalFetched: number;
  appliedCount: number;
  unchangedCount: number;
  failureCount: number;
  batches: number;
  errors: string[];
}

/**
 * Maps a row from `st_platform_verify_v1.demo_search_documents` into a `ProductOffer`
 * compatible with the existing OpenSearch projection writer and index mapping.
 */
export function searchDocumentToProductOffer(
  row: Record<string, unknown>
): ProductOffer {
  const storeIdStr = String(row.store_id);
  const baseOffer = mapRowToProductOffer(row, storeIdStr);

  // Return baseOffer with brand and tags preserved for top-level searchability
  return {
    ...baseOffer,
    ...(typeof row.brand === "string" ? { brand: row.brand } : {}),
    ...(Array.isArray(row.tags) ? { tags: row.tags } : {}),
  } as ProductOffer;
}

/**
 * Fetches search documents from PostgreSQL `st_platform_verify_v1.demo_search_documents`
 * using parameterized read-only queries.
 */
export async function fetchSearchDocuments(
  pool: Pool,
  options: Pick<SyncOptions, "limit" | "storeId" | "productId"> = {}
): Promise<Record<string, unknown>[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.storeId !== undefined) {
    params.push(String(options.storeId));
    conditions.push(`store_id::text = $${params.length}`);
  }

  if (options.productId !== undefined) {
    params.push(String(options.productId));
    conditions.push(`product_id::text = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitClause =
    typeof options.limit === "number" && options.limit > 0
      ? `LIMIT ${Math.floor(options.limit)}`
      : "";

  const query = `
    SELECT
      store_id,
      product_id,
      document_id,
      store_name,
      city,
      neighborhood,
      sku,
      product_name,
      brand,
      category,
      description,
      tags,
      attributes,
      price_paise,
      mrp_paise,
      book_stock,
      reserved_stock,
      available_stock,
      inventory_version,
      updated_at
    FROM st_platform_verify_v1.demo_search_documents
    ${whereClause}
    ORDER BY store_id, product_id
    ${limitClause};
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Syncs PostgreSQL product search documents to OpenSearch using the existing
 * projection writer and monotonic version guards.
 *
 * Repeatable and safe to run multiple times: existing documents with identical
 * or newer inventoryVersion will be reported as unchanged and not overwritten.
 */
export async function syncPostgresProductsToOpenSearch(
  options: SyncOptions = {}
): Promise<SyncResult> {
  const pool = await getOrCreatePool(options.pool);
  const client = options.client || getOpenSearchClient();
  const index = options.index || getOpenSearchConfig().index;
  const batchSize = Math.max(1, options.batchSize ?? 250);
  const refresh = options.refresh ?? false;

  // 1. Ensure target index exists with explicit mappings
  await setupProductIndex(client, index);

  // 2. Fetch documents from PostgreSQL search view
  const rows = await fetchSearchDocuments(pool, options);

  if (rows.length === 0) {
    return {
      totalFetched: 0,
      appliedCount: 0,
      unchangedCount: 0,
      failureCount: 0,
      batches: 0,
      errors: [],
    };
  }

  // 3. Transform to ProductOffers
  const offers: ProductOffer[] = rows.map(searchDocumentToProductOffer);

  // 4. Batch write using existing projection writer
  let appliedTotal = 0;
  let unchangedTotal = 0;
  let failureTotal = 0;
  const errors: string[] = [];
  const totalBatches = Math.ceil(offers.length / batchSize);

  for (let i = 0; i < offers.length; i += batchSize) {
    const batch = offers.slice(i, i + batchSize);
    const isLastBatch = i + batchSize >= offers.length;

    const result: ProjectionResult = await writeProjection(batch, {
      client,
      index,
      refresh: isLastBatch ? refresh : false,
    });

    appliedTotal += result.appliedCount;
    unchangedTotal += result.unchangedCount;
    failureTotal += result.failureCount;

    for (const item of result.items) {
      if (item.status === "failure" && item.error) {
        errors.push(`[${item.documentId}] ${item.error}`);
      }
    }

    if (options.onProgress) {
      options.onProgress({
        processed: Math.min(i + batchSize, offers.length),
        total: offers.length,
        applied: appliedTotal,
        unchanged: unchangedTotal,
        failed: failureTotal,
      });
    }
  }

  return {
    totalFetched: offers.length,
    appliedCount: appliedTotal,
    unchangedCount: unchangedTotal,
    failureCount: failureTotal,
    batches: totalBatches,
    errors,
  };
}

