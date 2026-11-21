import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  getOpenSearchClient,
} from "../server/discovery/opensearch-client";
import { setupProductIndex, deleteProductIndex } from "../server/discovery/index-definition";
import { syncPostgresProductsToOpenSearch } from "../server/discovery/postgres-index-syncer";
import { PostgresProductFactsReader } from "../server/discovery/postgres-product-facts-reader";
import { searchProducts } from "../server/discovery/search-service";

// Load .env.local if not already in process.env
const envLocalPath = resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  const content = readFileSync(envLocalPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[match[1]] = val;
    }
  }
}

const hasCredentials = Boolean(
  process.env.DATABASE_URL &&
    (process.env.OPENSEARCH_URL || process.env.OPENSEARCH_NODE)
);

// Dedicated isolated test index to prevent collisions with production or fixture indices
const TEST_SYNC_INDEX = "smart_tijori_test_pg_sync";

test(
  "live integration: PostgreSQL-to-OpenSearch product indexing and search",
  { skip: !hasCredentials },
  async (t) => {
    const client = getOpenSearchClient();
    const factsReader = new PostgresProductFactsReader();

    // Ensure clean isolated test index
    await setupProductIndex(client, TEST_SYNC_INDEX);

    t.after(async () => {
      try {
        await deleteProductIndex(client, TEST_SYNC_INDEX);
      } catch {
        // ignore cleanup error
      }
    });

    await t.test("syncs representative products (Aashirvaad, Tata Tea, Surf Excel) across stores", async () => {
      // Sync product 1 (Aashirvaad), 133 (Tata Tea), and 301 (Surf Excel) for stores 2 and 3
      const p1Sync = await syncPostgresProductsToOpenSearch({
        client,
        index: TEST_SYNC_INDEX,
        productId: 1,
        refresh: false,
      });
      const p133Sync = await syncPostgresProductsToOpenSearch({
        client,
        index: TEST_SYNC_INDEX,
        productId: 133,
        refresh: false,
      });
      const p301Sync = await syncPostgresProductsToOpenSearch({
        client,
        index: TEST_SYNC_INDEX,
        productId: 301,
        refresh: true, // Refresh index after last batch
      });

      assert.ok(p1Sync.appliedCount > 0, "Product 1 offers must be applied");
      assert.ok(p133Sync.appliedCount > 0, "Product 133 offers must be applied");
      assert.ok(p301Sync.appliedCount > 0, "Product 301 offers must be applied");

      // Verify document count in test index
      const countRes = await client.count({ index: TEST_SYNC_INDEX });
      assert.ok(countRes.body.count >= 15, "Index must contain the synced product offers across stores");
    });

    await t.test("verifies indexed documents have documentId format ${store_id}:${product_id}", async () => {
      // Check document "2:1" (Store 2, Product 1)
      const docRes = await client.get({
        index: TEST_SYNC_INDEX,
        id: "2:1",
      });

      assert.ok(docRes.body.found, "Document 2:1 must exist");
      const src = docRes.body._source as Record<string, unknown>;
      assert.equal(src.productId, "1");
      assert.equal(src.storeId, "2");
      assert.equal(src.city, "Bengaluru");
      assert.ok(String(src.name).includes("Aashirvaad"));
      assert.equal(src.pricePaise, 26600, "Store 2 price must be 26600 paise");
      assert.equal(src.inventoryVersion, 4);

      // Check document "2:133" (Store 2, Product 133: Tata Tea)
      const teaDoc = await client.get({
        index: TEST_SYNC_INDEX,
        id: "2:133",
      });
      assert.ok(teaDoc.body.found, "Document 2:133 must exist");
      const teaSrc = teaDoc.body._source as Record<string, unknown>;
      assert.equal(teaSrc.productId, "133");
      assert.ok(String(teaSrc.name).includes("Tata Tea"));

      // Check document "2:301" (Store 2, Product 301: Surf Excel)
      const surfDoc = await client.get({
        index: TEST_SYNC_INDEX,
        id: "2:301",
      });
      assert.ok(surfDoc.body.found, "Document 2:301 must exist");
      const surfSrc = surfDoc.body._source as Record<string, unknown>;
      assert.equal(surfSrc.productId, "301");
      assert.ok(String(surfSrc.name).includes("Surf Excel"));
    });

    await t.test("verifies PostgresProductFactsReader hydrates indexed product IDs", async () => {
      const hydrated = await factsReader.readProductFacts("2", ["1", "133", "301"]);
      assert.equal(hydrated.length, 3, "Expected 3 products hydrated");

      const p1 = hydrated.find((h) => h.productId === "1");
      assert.ok(p1);
      assert.equal(p1.storeId, "2");
      assert.ok(p1.name.includes("Aashirvaad"));
      assert.equal(p1.pricePaise, 26600);
      assert.equal(p1.available, true);

      const p133 = hydrated.find((h) => h.productId === "133");
      assert.ok(p133);
      assert.ok(p133.name.includes("Tata Tea"));
      assert.equal(p133.pricePaise, 14250);

      const p301 = hydrated.find((h) => h.productId === "301");
      assert.ok(p301);
      assert.ok(p301.name.includes("Surf Excel"));
    });

    await t.test("verifies search for Aashirvaad, Tata Tea, and Surf Excel", async () => {
      // 1. Search Aashirvaad
      const aashirvaadRes = await searchProducts({
        q: "Aashirvaad",
        client,
        index: TEST_SYNC_INDEX,
        factsReader,
        storeId: "2",
      });
      assert.ok(aashirvaadRes.items.length > 0);
      assert.equal(aashirvaadRes.items[0].productId, "1");
      assert.ok(aashirvaadRes.items[0].name.includes("Aashirvaad Whole Wheat Atta"));

      // 2. Search Tata Tea
      const tataTeaRes = await searchProducts({
        q: "Tata Tea",
        client,
        index: TEST_SYNC_INDEX,
        factsReader,
        storeId: "2",
      });
      assert.ok(tataTeaRes.items.length > 0);
      assert.equal(tataTeaRes.items[0].productId, "133");
      assert.ok(tataTeaRes.items[0].name.includes("Tata Tea"));

      // 3. Search Surf Excel
      const surfRes = await searchProducts({
        q: "Surf Excel",
        client,
        index: TEST_SYNC_INDEX,
        factsReader,
        storeId: "2",
      });
      assert.ok(surfRes.items.length > 0);
      assert.equal(surfRes.items[0].productId, "301");
      assert.ok(surfRes.items[0].name.includes("Surf Excel"));
    });

    await t.test("verifies store-specific pricing and availability", async () => {
      // In PostgreSQL:
      // Store 2: Product 1 price is 26600 paise
      // Store 3: Product 1 price is 26880 paise
      const store2Search = await searchProducts({
        q: "Aashirvaad",
        client,
        index: TEST_SYNC_INDEX,
        factsReader,
        storeId: "2",
      });
      const store3Search = await searchProducts({
        q: "Aashirvaad",
        client,
        index: TEST_SYNC_INDEX,
        factsReader,
        storeId: "3",
      });

      assert.ok(store2Search.items.length > 0);
      assert.ok(store3Search.items.length > 0);

      const store2Item = store2Search.items[0];
      const store3Item = store3Search.items[0];

      assert.equal(store2Item.storeId, "2");
      assert.equal(store2Item.pricePaise, 26600, "Store 2 price must be 266.00");

      assert.equal(store3Item.storeId, "3");
      assert.equal(store3Item.pricePaise, 26880, "Store 3 price must be 268.80");

      assert.notEqual(
        store2Item.pricePaise,
        store3Item.pricePaise,
        "Store pricing must be distinct per store"
      );
    });

    await t.test("verifies repeated indexing does not create duplicate documents (idempotent)", async () => {
      const countBefore = await client.count({ index: TEST_SYNC_INDEX });

      // Re-run sync with identical parameters for product 1
      const repeatResult = await syncPostgresProductsToOpenSearch({
        client,
        index: TEST_SYNC_INDEX,
        productId: 1,
        refresh: true,
      });

      assert.equal(
        repeatResult.appliedCount,
        0,
        "No documents should be applied on repeat sync with identical version"
      );
      assert.ok(
        repeatResult.unchangedCount > 0,
        "Documents must be reported unchanged due to monotonic version check"
      );
      assert.equal(repeatResult.failureCount, 0);

      // Verify total document count did NOT change
      const countAfter = await client.count({ index: TEST_SYNC_INDEX });
      assert.equal(
        countAfter.body.count,
        countBefore.body.count,
        "Total document count must remain identical (no duplicates)"
      );
    });
  }
);
