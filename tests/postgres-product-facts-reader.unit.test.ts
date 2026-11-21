import assert from "node:assert/strict";
import test from "node:test";
import type { Client } from "@opensearch-project/opensearch";
import { createPostgresProductFactsReader } from "../server/discovery/postgres-product-facts-reader";
import { searchProducts } from "../server/discovery/search-service";
import type { ProductOffer } from "../server/contracts/commerce";

const storedOffer: ProductOffer = {
  productId: "tea-250", storeId: "blr-01", city: "Bengaluru", name: "Nilgiri Tea",
  category: "pantry", purpose: "tea", pricePaise: 15000, imageUrl: null,
  pack: { quantity: 250, unit: "g" }, attributes: { leaf: "black" },
  available: 0, inventoryVersion: 7, checkedAt: "2026-11-21T12:00:00.000Z",
};

test("discovery preserves PostgreSQL product identity and stock version", async () => {
  const reader = createPostgresProductFactsReader({
    async readProductFacts(storeId, ids) {
      assert.equal(storeId, "blr-01");
      assert.deepEqual(ids, ["tea-250", "unlisted"]);
      return [storedOffer];
    },
  });
  const [offer, unlisted] = await reader.readProductFacts("blr-01", ["tea-250", "unlisted"]);
  assert.equal(unlisted, undefined);
  assert.equal(offer.productId, "tea-250");
  assert.equal(offer.available, false);
  assert.equal(offer.availableStock, 0);
  assert.equal(offer.inventoryVersion, 7);
  assert.equal(offer.pricePaise, 15000);
  assert.deepEqual(offer.knownAttributes, { leaf: "black" });
});

test("discovery propagates unavailable PostgreSQL facts", async () => {
  const reader = createPostgresProductFactsReader({
    async readProductFacts() { throw new Error("Connection closed"); },
  });
  await assert.rejects(reader.readProductFacts("blr-01", ["tea-250"]), /Connection closed/);
});

test("discovery retains the authoritative quantity for the shopper catalog", async () => {
  const reader = createPostgresProductFactsReader({
    async readProductFacts() { return [{ ...storedOffer, available: 8 }]; },
  });
  const [offer] = await reader.readProductFacts("blr-01", ["tea-250"]);
  assert.equal(offer.available, true);
  assert.equal(offer.availableStock, 8);
});

test("search filters current branch, city, category, stock and price despite stale hits", async () => {
  const client = {
    async search({ body }: { body: { query: unknown } }) {
      assert.doesNotMatch(JSON.stringify(body.query), /pricePaise/);
      const hits = [
        ["blr-01", "tea-250", 19000],
        ["blr-01", "expensive", 15000],
        ["blr-01", "wrong-city", 15000],
        ["blr-01", "wrong-category", 15000],
        ["blr-01", "sold-out", 15000],
        ["blr-01", "missing", 15000],
        ["mys-01", "tea-250", 15000],
        ["blr-01", "tea-250", 19000],
      ].map(([storeId, productId, pricePaise]) => ({ _source: { storeId, productId, pricePaise } }));
      return { body: { hits: { hits } } };
    },
  } as unknown as Client;
  const factsReader = createPostgresProductFactsReader({
    async readProductFacts(storeId) {
      const offer = { ...storedOffer, storeId, available: 8 };
      return [
        offer,
        { ...offer, productId: "expensive", pricePaise: 16000 },
        { ...offer, productId: "wrong-city", city: "Mysuru" },
        { ...offer, productId: "wrong-category", category: "household" },
        { ...offer, productId: "sold-out", available: 0 },
      ];
    },
  });
  const options = {
    client, index: "test", factsReader, storeId: "blr-01", city: "Bengaluru",
    category: "pantry", minPricePaise: 15000, maxPricePaise: 15000,
  };
  const inStock = await searchProducts(options);
  assert.deepEqual(inStock.items.map(({ productId, pricePaise, availableStock }) =>
    [productId, pricePaise, availableStock]), [["tea-250", 15000, 8]]);
  const all = await searchProducts({ ...options, includeUnavailable: true });
  assert.deepEqual(all.items.map(({ productId, availableStock }) =>
    [productId, availableStock]), [["tea-250", 8], ["sold-out", 0]]);
});
