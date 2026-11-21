import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, QueryResult } from "pg";
import {
  PostgresProductFactsReader,
  mapRowToProductOffer,
  parsePack,
} from "../server/discovery/postgres-product-facts-reader";

// Helper to mock a pg Pool
function createMockPool(mockRows: Record<string, unknown>[]): Pool {
  return {
    query: async (_sql: string, params: unknown[]): Promise<QueryResult> => {
      const storeParam = params[0] as string;
      const productIdsParam = params[1] as string[];

      const filtered = mockRows.filter((r) => {
        const storeMatch =
          String(r.store_id) === storeParam ||
          (storeParam === "blr-01" && Number(r.store_id) === 2) ||
          (storeParam === "mys-01" && Number(r.store_id) === 1);
        const productMatch =
          productIdsParam.includes(String(r.product_id)) ||
          (typeof r.sku === "string" && productIdsParam.includes(r.sku));
        return storeMatch && productMatch;
      });

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

const SAMPLE_ROWS: Record<string, unknown>[] = [
  // Store 2, Product 1: Available stock (18 - 3 = 15 > 0)
  {
    store_id: 2,
    product_id: 1,
    sku: "ST-SKU-00001",
    store_name: "Indiranagar Essentials",
    city: "Bengaluru",
    product_name: "Aashirvaad Whole Wheat Atta - Standard",
    brand: "Aashirvaad",
    category: "Groceries",
    description: "Pure wheat flour",
    attributes: { family: "Whole Wheat Atta", variant: "Standard", basePricePaise: 28000 },
    tags: ["groceries", "atta"],
    price_paise: 26600,
    mrp_paise: 27200,
    book_stock: 18,
    reserved_stock: 3,
    inventory_version: "4",
    updated_at: "2026-11-21T10:47:59.887Z",
  },
  // Store 2, Product 13: Available stock (20 - 0 = 20 > 0)
  {
    store_id: 2,
    product_id: 13,
    sku: "ST-SKU-00013",
    store_name: "Indiranagar Essentials",
    city: "Bengaluru",
    product_name: "India Gate Basmati Rice - 1kg",
    brand: "India Gate",
    category: "Groceries",
    description: "Premium basmati rice",
    attributes: { family: "Basmati Rice", variant: "Standard" },
    tags: ["rice"],
    price_paise: 39900,
    mrp_paise: 42000,
    book_stock: 20,
    reserved_stock: 0,
    inventory_version: "16",
    updated_at: "2026-11-21T10:35:59.887Z",
  },
  // Store 2, Product 25: Out of stock (0 - 0 = 0)
  {
    store_id: 2,
    product_id: 25,
    sku: "ST-SKU-00025",
    store_name: "Indiranagar Essentials",
    city: "Bengaluru",
    product_name: "Tata Sampann Toor Dal - Standard",
    brand: "Tata Sampann",
    category: "Groceries",
    description: "Unpolished toor dal",
    attributes: { family: "Toor Dal", variant: "Standard" },
    tags: ["pulses"],
    price_paise: 15200,
    mrp_paise: 16000,
    book_stock: 0,
    reserved_stock: 0,
    inventory_version: "4",
    updated_at: "2026-11-21T10:23:59.887Z",
  },
  // Store 2, Product 37: Reserved equals book stock (5 - 5 = 0, unavailable)
  {
    store_id: 2,
    product_id: 37,
    sku: "ST-SKU-00037",
    store_name: "Indiranagar Essentials",
    city: "Bengaluru",
    product_name: "Fortune Sunflower Oil - 1l",
    brand: "Fortune",
    category: "Groceries",
    description: "Refined sunflower oil",
    attributes: { family: "Sunflower Oil" },
    tags: ["oil"],
    price_paise: 19000,
    mrp_paise: 20000,
    book_stock: 5,
    reserved_stock: 5,
    inventory_version: "7",
    updated_at: "2026-11-21T10:20:00.000Z",
  },
  // Store 1, Product 1: Different store facts (Store 1)
  {
    store_id: 1,
    product_id: 1,
    sku: "ST-SKU-00001",
    store_name: "Koramangala Market",
    city: "Bengaluru",
    product_name: "Aashirvaad Whole Wheat Atta - Standard",
    brand: "Aashirvaad",
    category: "Groceries",
    description: "Pure wheat flour",
    attributes: { family: "Whole Wheat Atta" },
    tags: ["atta"],
    price_paise: 27000,
    mrp_paise: 28000,
    book_stock: 10,
    reserved_stock: 1,
    inventory_version: "2",
    updated_at: "2026-11-21T10:00:00.000Z",
  },
];

test("unit: parsePack parses quantities and units correctly", () => {
  assert.deepEqual(parsePack("India Gate Basmati Rice - 1kg", {}), { quantity: 1, unit: "kg" });
  assert.deepEqual(parsePack("Fortune Sunflower Oil - 500ml", {}), { quantity: 500, unit: "ml" });
  assert.deepEqual(parsePack("Generic Item", { packQuantity: 2, packUnit: "count" }), { quantity: 2, unit: "count" });
  assert.deepEqual(parsePack("Unknown Item Without Numbers", {}), { quantity: 1, unit: "count" });
});

test("unit: mapRowToProductOffer produces a valid ProductOffer contract", () => {
  const row = SAMPLE_ROWS[0];
  const offer = mapRowToProductOffer(row, "2");

  assert.equal(offer.productId, "1");
  assert.equal(offer.storeId, "2");
  assert.equal(offer.city, "Bengaluru");
  assert.equal(offer.name, "Aashirvaad Whole Wheat Atta - Standard");
  assert.equal(offer.category, "Groceries");
  assert.equal(offer.purpose, "whole-wheat-atta");
  assert.equal(offer.pricePaise, 26600);
  assert.equal(offer.available, true);
  assert.equal(offer.inventoryVersion, 4);
  assert.ok(typeof offer.checkedAt === "string");
  assert.ok(typeof offer.imageUrl === "string");
  assert.equal(offer.knownAttributes.brand, "Aashirvaad");
  assert.equal(offer.knownAttributes.availableStock, 15);
});

test("unit: readProductFacts calculates availability correctly (available stock)", async () => {
  const reader = new PostgresProductFactsReader(createMockPool(SAMPLE_ROWS));
  const offers = await reader.readProductFacts("2", ["1"]);

  assert.equal(offers.length, 1);
  assert.equal(offers[0].productId, "1");
  assert.equal(offers[0].available, true);
  assert.equal(offers[0].pricePaise, 26600);
  assert.equal(offers[0].inventoryVersion, 4);
});

test("unit: readProductFacts calculates availability correctly (zero or fully-reserved stock)", async () => {
  const reader = new PostgresProductFactsReader(createMockPool(SAMPLE_ROWS));
  // Product 25 has book_stock = 0; Product 37 has book_stock = reserved_stock = 5
  const offers = await reader.readProductFacts("2", ["25", "37"]);

  assert.equal(offers.length, 2);
  const p25 = offers.find((o) => o.productId === "25");
  const p37 = offers.find((o) => o.productId === "37");

  assert.ok(p25);
  assert.equal(p25.available, false, "Product 25 with 0 stock must be unavailable");

  assert.ok(p37);
  assert.equal(p37.available, false, "Product 37 with book_stock == reserved_stock must be unavailable");
});

test("unit: readProductFacts omits missing product IDs as required by contract", async () => {
  const reader = new PostgresProductFactsReader(createMockPool(SAMPLE_ROWS));
  // Requesting valid product 1 and missing products 999, 888
  const offers = await reader.readProductFacts("2", ["1", "999", "888"]);

  assert.equal(offers.length, 1, "Only existing product 1 should be returned");
  assert.equal(offers[0].productId, "1");
});

test("unit: readProductFacts retrieves multiple products in a batch preserving order", async () => {
  const reader = new PostgresProductFactsReader(createMockPool(SAMPLE_ROWS));
  const offers = await reader.readProductFacts("2", ["13", "1", "25"]);

  assert.equal(offers.length, 3);
  assert.equal(offers[0].productId, "13");
  assert.equal(offers[1].productId, "1");
  assert.equal(offers[2].productId, "25");
});

test("unit: readProductFacts isolates facts by store ID", async () => {
  const reader = new PostgresProductFactsReader(createMockPool(SAMPLE_ROWS));

  // Store 2 has price 26600
  const offersStore2 = await reader.readProductFacts("2", ["1"]);
  assert.equal(offersStore2.length, 1);
  assert.equal(offersStore2[0].pricePaise, 26600);
  assert.equal(offersStore2[0].storeId, "2");

  // Store 1 has price 27000
  const offersStore1 = await reader.readProductFacts("1", ["1"]);
  assert.equal(offersStore1.length, 1);
  assert.equal(offersStore1[0].pricePaise, 27000);
  assert.equal(offersStore1[0].storeId, "1");
});

test("unit: readProductFacts handles empty productIds list safely", async () => {
  const reader = new PostgresProductFactsReader(createMockPool(SAMPLE_ROWS));
  const offers = await reader.readProductFacts("2", []);
  assert.deepEqual(offers, []);
});

