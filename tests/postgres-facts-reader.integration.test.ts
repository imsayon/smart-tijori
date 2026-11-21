import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { PostgresProductFactsReader } from "../server/discovery/postgres-product-facts-reader";

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

// Check if Aiven PostgreSQL credentials are available
const hasPostgres = Boolean(process.env.DATABASE_URL);

test("live integration: PostgresProductFactsReader against Aiven PostgreSQL", { skip: !hasPostgres }, async (t) => {
  const reader = new PostgresProductFactsReader();

  await t.test("reads live facts for multiple products in store 2", async () => {
    const offers = await reader.readProductFacts("2", ["1", "13"]);
    assert.equal(offers.length, 2, "Expected exactly 2 products returned");

    const p1 = offers.find((o) => o.productId === "1");
    assert.ok(p1, "Product 1 must be present");
    assert.equal(p1.storeId, "2");
    assert.equal(p1.city, "Bengaluru");
    assert.ok(p1.name.includes("Aashirvaad"), "Product name must match Aashirvaad");
    assert.ok(p1.pricePaise > 0, "Price in paise must be positive");
    assert.equal(typeof p1.available, "boolean");
    assert.ok(p1.inventoryVersion > 0, "Inventory version must be positive");
    assert.ok(p1.checkedAt.endsWith("Z"), "checkedAt must be an ISO timestamp");

    const p13 = offers.find((o) => o.productId === "13");
    assert.ok(p13, "Product 13 must be present");
    assert.ok(p13.name.includes("India Gate"), "Product name must match India Gate");
  });

  await t.test("verifies availability calculation from book_stock - reserved_stock", async () => {
    // In store 1, product 25 has book_stock = 0 and reserved_stock = 0
    const offers = await reader.readProductFacts("1", ["25"]);
    assert.equal(offers.length, 1);
    assert.equal(offers[0].productId, "25");
    assert.equal(offers[0].available, false, "Product 25 in store 1 with 0 available stock must be unavailable");
  });

  await t.test("omits missing product IDs as required by the contract", async () => {
    const offers = await reader.readProductFacts("2", ["1", "non-existent-product-id-999999"]);
    assert.equal(offers.length, 1, "Missing product must be omitted");
    assert.equal(offers[0].productId, "1");
  });

  await t.test("retrieves store-specific pricing across different branches", async () => {
    const store2Offers = await reader.readProductFacts("2", ["1"]);
    const store3Offers = await reader.readProductFacts("3", ["1"]);

    assert.equal(store2Offers.length, 1);
    assert.equal(store3Offers.length, 1);

    assert.equal(store2Offers[0].storeId, "2");
    assert.equal(store3Offers[0].storeId, "3");
    // Verify distinct branch prices
    assert.ok(store2Offers[0].pricePaise > 0);
    assert.ok(store3Offers[0].pricePaise > 0);
    assert.notEqual(store2Offers[0].pricePaise, store3Offers[0].pricePaise);
  });

  await t.test("supports store alias blr-01 mapping to store 2", async () => {
    const offers = await reader.readProductFacts("blr-01", ["1"]);
    assert.equal(offers.length, 1);
    assert.equal(offers[0].productId, "1");
    assert.equal(offers[0].storeId, "blr-01");
    assert.ok(offers[0].name.includes("Aashirvaad"));
  });

  await t.test("preserves batch ordering of requested product IDs", async () => {
    const offers = await reader.readProductFacts("2", ["13", "1", "25"]);
    assert.equal(offers.length, 3);
    assert.equal(offers[0].productId, "13");
    assert.equal(offers[1].productId, "1");
    assert.equal(offers[2].productId, "25");
  });
});
