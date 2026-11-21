import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, QueryResult } from "pg";
import type { Client } from "@opensearch-project/opensearch";
import {
  searchDocumentToProductOffer,
  fetchSearchDocuments,
  syncPostgresProductsToOpenSearch,
} from "../server/discovery/postgres-index-syncer";
import { validateProductOffer, getDocumentId } from "../server/discovery/projection-writer";

const SAMPLE_SEARCH_DOCS: Record<string, unknown>[] = [
  {
    store_id: 2,
    product_id: 1,
    document_id: "2:1",
    store_name: "Indiranagar Essentials",
    city: "Bengaluru",
    neighborhood: "Indiranagar",
    sku: "ST-SKU-00001",
    product_name: "Aashirvaad Whole Wheat Atta - Standard",
    brand: "Aashirvaad",
    category: "Groceries",
    description: "Aashirvaad Whole Wheat Atta retail catalog entry.",
    tags: ["groceries", "aashirvaad", "whole wheat atta"],
    attributes: { family: "Whole Wheat Atta", variant: "Standard", basePricePaise: 28000 },
    price_paise: 26600,
    mrp_paise: 27200,
    book_stock: 18,
    reserved_stock: 3,
    available_stock: 15,
    inventory_version: "4",
    updated_at: "2026-11-21T10:47:59.887Z",
  },
  {
    store_id: 2,
    product_id: 133,
    document_id: "2:133",
    store_name: "Indiranagar Essentials",
    city: "Bengaluru",
    neighborhood: "Indiranagar",
    sku: "ST-SKU-00133",
    product_name: "Tata Tea Masala Tea - Standard",
    brand: "Tata Tea",
    category: "Beverages",
    description: "Tata Tea Masala Tea retail catalog entry.",
    tags: ["beverages", "tata tea", "masala tea"],
    attributes: { family: "Masala Tea", variant: "Standard", basePricePaise: 15000 },
    price_paise: 14250,
    mrp_paise: 14850,
    book_stock: 42,
    reserved_stock: 3,
    available_stock: 39,
    inventory_version: "16",
    updated_at: "2026-11-21T08:35:59.887Z",
  },
  {
    store_id: 2,
    product_id: 301,
    document_id: "2:301",
    store_name: "Indiranagar Essentials",
    city: "Bengaluru",
    neighborhood: "Indiranagar",
    sku: "ST-SKU-00301",
    product_name: "Surf Excel Liquid Detergent - Standard",
    brand: "Surf Excel",
    category: "Home & Cleaning",
    description: "Surf Excel Liquid Detergent retail catalog entry.",
    tags: ["cleaning", "surf excel", "detergent"],
    attributes: { family: "Liquid Detergent", variant: "Standard", basePricePaise: 29000 },
    price_paise: 27550,
    mrp_paise: 28150,
    book_stock: 5,
    reserved_stock: 5,
    available_stock: 0, // Out of stock (5 - 5 = 0)
    inventory_version: "8",
    updated_at: "2026-11-21T09:12:00.000Z",
  },
];

function createMockPgPool(rows: Record<string, unknown>[]): Pool {
  return {
    query: async (sql: string, params: unknown[]): Promise<QueryResult> => {
      let filtered = [...rows];

      // Check store_id filter
      if (sql.includes("store_id::text = $")) {
        const storeParam = params[0] as string;
        filtered = filtered.filter((r) => String(r.store_id) === storeParam);
      }

      // Check product_id filter
      if (sql.includes("product_id::text = $")) {
        const prodParam = (params.length > 1 ? params[1] : params[0]) as string;
        filtered = filtered.filter((r) => String(r.product_id) === prodParam);
      }

      // Check limit
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        filtered = filtered.slice(0, parseInt(limitMatch[1], 10));
      }

      return {
        rows: filtered,
        command: "SELECT",
        rowCount: filtered.length,
        oid: 0,
        fields: [],
      };
    },
  } as unknown as Pool;
}

test("searchDocumentToProductOffer: correctly maps database row to ProductOffer contract", () => {
  const row = SAMPLE_SEARCH_DOCS[0];
  const offer = searchDocumentToProductOffer(row);

  assert.equal(offer.productId, "1");
  assert.equal(offer.storeId, "2");
  assert.equal(offer.city, "Bengaluru");
  assert.equal(offer.name, "Aashirvaad Whole Wheat Atta - Standard");
  assert.equal(offer.category, "Groceries");
  assert.equal(offer.purpose, "whole-wheat-atta");
  assert.equal(offer.pricePaise, 26600);
  assert.equal(offer.available, true); // 18 - 3 = 15 > 0
  assert.equal(offer.inventoryVersion, 4);

  // Document ID matches ${store_id}:${product_id}
  const docId = getDocumentId(offer.storeId, offer.productId);
  assert.equal(docId, "2:1");

  // Preserves knownAttributes
  assert.equal(offer.knownAttributes.brand, "Aashirvaad");
  assert.equal(offer.knownAttributes.sku, "ST-SKU-00001");
  assert.equal(offer.knownAttributes.bookStock, 18);
  assert.equal(offer.knownAttributes.reservedStock, 3);
  assert.equal(offer.knownAttributes.availableStock, 15);

  // Passes strict validation
  assert.equal(validateProductOffer(offer), null);
});

test("searchDocumentToProductOffer: marks zero-stock product as unavailable", () => {
  const row = SAMPLE_SEARCH_DOCS[2]; // Surf Excel with book_stock=5, reserved_stock=5
  const offer = searchDocumentToProductOffer(row);

  assert.equal(offer.productId, "301");
  assert.equal(offer.storeId, "2");
  assert.equal(offer.available, false); // 5 - 5 = 0, not > 0
  assert.equal(offer.knownAttributes.availableStock, 0);
  assert.equal(validateProductOffer(offer), null);
});

test("fetchSearchDocuments: executes parameterized query with filters and limit", async () => {
  const pool = createMockPgPool(SAMPLE_SEARCH_DOCS);

  // Fetch all
  const allRows = await fetchSearchDocuments(pool);
  assert.equal(allRows.length, 3);

  // Filter by store
  const store2Rows = await fetchSearchDocuments(pool, { storeId: 2 });
  assert.equal(store2Rows.length, 3);

  // Filter by product
  const prod1Rows = await fetchSearchDocuments(pool, { productId: 1 });
  assert.equal(prod1Rows.length, 1);
  assert.equal(prod1Rows[0].product_id, 1);

  // With limit
  const limitedRows = await fetchSearchDocuments(pool, { limit: 2 });
  assert.equal(limitedRows.length, 2);
});

test("syncPostgresProductsToOpenSearch: performs initial sync with mock OpenSearch client", async () => {
  const pool = createMockPgPool(SAMPLE_SEARCH_DOCS);

  const indexedDocs = new Map<string, Record<string, unknown>>();
  const docVersions = new Map<string, number>();

  const mockClient: Client = {
    indices: {
      exists: async () => ({ body: true }),
      create: async () => ({ body: { acknowledged: true } }),
    },
    bulk: async (params: { body: unknown[] }) => {
      const ops = params.body;
      const items: Array<Record<string, { status: number }>> = [];

      for (let i = 0; i < ops.length; i += 2) {
        const action = ops[i] as { index: { _id: string; version?: number; version_type?: string } };
        const doc = ops[i + 1] as Record<string, unknown>;
        const id = action.index._id;
        const incomingVersion = action.index.version ?? 1;
        const currentVersion = docVersions.get(id);

        if (
          action.index.version_type === "external" &&
          currentVersion !== undefined &&
          incomingVersion <= currentVersion
        ) {
          items.push({ index: { status: 409 } });
        } else {
          indexedDocs.set(id, doc);
          docVersions.set(id, incomingVersion);
          items.push({ index: { status: 201 } });
        }
      }

      return { body: { items } };
    },
  } as unknown as Client;

  // Run 1: First indexing
  const result1 = await syncPostgresProductsToOpenSearch({
    pool,
    client: mockClient,
    index: "test_index",
    batchSize: 2,
  });

  assert.equal(result1.totalFetched, 3);
  assert.equal(result1.appliedCount, 3);
  assert.equal(result1.unchangedCount, 0);
  assert.equal(result1.failureCount, 0);
  assert.equal(result1.batches, 2); // 3 items / batchSize 2 = 2 batches
  assert.equal(indexedDocs.size, 3);

  // Verify document IDs
  assert.ok(indexedDocs.has("2:1"));
  assert.ok(indexedDocs.has("2:133"));
  assert.ok(indexedDocs.has("2:301"));

  // Verify document fields
  const doc1 = indexedDocs.get("2:1")!;
  assert.equal(doc1.productId, "1");
  assert.equal(doc1.storeId, "2");
  assert.equal(doc1.name, "Aashirvaad Whole Wheat Atta - Standard");
  assert.equal(doc1.pricePaise, 26600);
  assert.equal(doc1.inventoryVersion, 4);

  // Run 2: Repeat indexing (idempotent, version guard prevents duplicate writes)
  const result2 = await syncPostgresProductsToOpenSearch({
    pool,
    client: mockClient,
    index: "test_index",
    batchSize: 2,
  });

  assert.equal(result2.totalFetched, 3);
  assert.equal(result2.appliedCount, 0, "No documents should be re-applied");
  assert.equal(result2.unchangedCount, 3, "All documents should be unchanged due to version guard");
  assert.equal(result2.failureCount, 0);
  assert.equal(indexedDocs.size, 3, "No duplicate documents created");
});

