import assert from "node:assert/strict";
import test from "node:test";
import {
  BASE_24_CATALOG_ITEMS,
  FIXTURE_STORES,
  FixtureProductFactsReader,
  buildFixtureOffers,
  IS_DEVELOPMENT_FIXTURE,
} from "../server/discovery/fixtures/catalog-fixture";
import { getDocumentId, validateProductOffer } from "../server/discovery/projection-writer";
import type { ProductOffer } from "../server/contracts/catalog";

test("development fixture is explicitly flagged as development data", () => {
  assert.equal(IS_DEVELOPMENT_FIXTURE, true);
});

test("curated catalog contains exactly 24 distinct items across expected categories", () => {
  assert.equal(BASE_24_CATALOG_ITEMS.length, 24);

  const categories = new Set(BASE_24_CATALOG_ITEMS.map((item) => item.category));
  assert.ok(categories.has("Laundry & Detergents"));
  assert.ok(categories.has("Tea & Beverages"));
  assert.ok(categories.has("Cooking Oils & Ghee"));
  assert.ok(categories.has("Staples & Pulses"));
  assert.ok(categories.has("Household Cleaning"));

  // Check unique product IDs
  const productIds = new Set(BASE_24_CATALOG_ITEMS.map((item) => item.productId));
  assert.equal(productIds.size, 24);

  // Validate every item has required fields
  for (const item of BASE_24_CATALOG_ITEMS) {
    assert.ok(item.productId.length > 0);
    assert.ok(item.name.length > 0);
    assert.ok(item.purpose.length > 0);
    assert.ok(item.description.length > 0);
    assert.ok(item.pricePaise > 0);
    assert.ok(item.pack.quantity > 0);
    assert.ok(item.pack.unit.length > 0);
    assert.ok(typeof item.knownAttributes === "object");
  }
});

test("buildFixtureOffers covers both blr-01 and mys-01 stores (48 offers total)", () => {
  const offers = buildFixtureOffers();
  assert.equal(offers.length, 48);

  const blrOffers = offers.filter((o) => o.storeId === "blr-01");
  const mysOffers = offers.filter((o) => o.storeId === "mys-01");

  assert.equal(blrOffers.length, 24);
  assert.equal(mysOffers.length, 24);

  assert.equal(FIXTURE_STORES.length, 2);
  assert.equal(FIXTURE_STORES[0].id, "blr-01");
  assert.equal(FIXTURE_STORES[1].id, "mys-01");
});

test("FixtureProductFactsReader implements ProductFactsReader interface", async () => {
  const reader = new FixtureProductFactsReader();

  const facts = await reader.readProductFacts("blr-01", [
    "det-surf-matic-front-1l",
    "det-ariel-matic-front-1l",
    "non-existent-product",
  ]);

  // Missing products must be omitted
  assert.equal(facts.length, 2);
  assert.equal(facts[0].productId, "det-surf-matic-front-1l");
  assert.equal(facts[0].storeId, "blr-01");
  assert.equal(facts[1].productId, "det-ariel-matic-front-1l");
  assert.equal(facts[1].storeId, "blr-01");
});

test("validateProductOffer detects valid and invalid product offers", () => {
  const validOffer: ProductOffer = {
    productId: "det-surf-matic-front-1l",
    storeId: "blr-01",
    city: "Bengaluru",
    name: "Surf Excel",
    category: "Laundry",
    purpose: "front-load-detergent",
    pricePaise: 28000,
    imageUrl: "/images/p.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: { machineType: "front-load" },
    available: true,
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
  };

  assert.equal(validateProductOffer(validOffer), null);

  // Missing productId
  assert.match(
    validateProductOffer({ ...validOffer, productId: "" }) || "",
    /Missing or invalid productId/
  );

  // Missing storeId
  assert.match(
    validateProductOffer({ ...validOffer, storeId: "" }) || "",
    /Missing or invalid storeId/
  );

  // Negative price
  assert.match(
    validateProductOffer({ ...validOffer, pricePaise: -100 }) || "",
    /Missing or invalid pricePaise/
  );

  // Invalid inventory version
  assert.match(
    validateProductOffer({ ...validOffer, inventoryVersion: -1 }) || "",
    /Missing or invalid inventoryVersion/
  );
});

test("getDocumentId generates stable storeId:productId identifier", () => {
  assert.equal(getDocumentId("blr-01", "det-surf-matic-front-1l"), "blr-01:det-surf-matic-front-1l");
  assert.equal(getDocumentId("mys-01", "bev-red-label-tea-500g"), "mys-01:bev-red-label-tea-500g");
});

