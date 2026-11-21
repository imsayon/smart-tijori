import assert from "node:assert/strict";
import test from "node:test";
import { createPostgresProductFactsReader } from "../server/discovery/postgres-product-facts-reader";
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
