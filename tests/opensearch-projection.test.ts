import assert from "node:assert/strict";
import test from "node:test";
import {
  getOpenSearchClient,
  getOpenSearchConfig,
  checkOpenSearchHealth,
} from "../server/discovery/opensearch-client";
import { setupProductIndex } from "../server/discovery/index-definition";
import {
  writeProjection,
  getDocumentId,
} from "../server/discovery/projection-writer";
import { buildFixtureOffers } from "../server/discovery/fixtures/catalog-fixture";
import type { ProductOffer } from "../server/contracts/catalog";

// Use a dedicated isolated test index to prevent collisions
const TEST_INDEX = "smart_tijori_test_projection";

test.before(async () => {
  const client = getOpenSearchClient();
  // Ensure the test index is created with proper mappings
  await setupProductIndex(client, TEST_INDEX);
});

test.after(async () => {
  const client = getOpenSearchClient();
  try {
    await client.indices.delete({ index: TEST_INDEX });
  } catch {
    // ignore
  }
});

test("Aiven OpenSearch client connects and reports healthy status", async () => {
  const client = getOpenSearchClient();
  const health = await checkOpenSearchHealth(client);

  assert.ok(health.healthy, `Expected healthy cluster, got status ${health.status}`);
  assert.ok(health.clusterName.length > 0);
  assert.ok(health.version.length > 0);
});

test("OpenSearch configuration validates required credentials and rejects localhost", () => {
  const config = getOpenSearchConfig();
  assert.ok(config.url.startsWith("https://"));
  assert.ok(config.username && config.username.length > 0);
  assert.ok(config.password && config.password.length > 0);

  // Verify hostname is not localhost
  const host = new URL(config.url).hostname;
  assert.notEqual(host, "localhost");
  assert.notEqual(host, "127.0.0.1");
});

test("writeProjection successfully indexes all 24 curated catalog products (48 offers)", async () => {
  const offers = buildFixtureOffers();
  assert.equal(offers.length, 48);

  const result = await writeProjection(offers, {
    index: TEST_INDEX,
    refresh: "wait_for",
  });

  assert.equal(result.failureCount, 0, `Expected 0 failures, got: ${JSON.stringify(result.items.filter(i => i.status === "failure"))}`);
  assert.equal(result.appliedCount, 48);
  assert.equal(result.unchangedCount, 0);

  // Verify a document is readable with stable ID
  const client = getOpenSearchClient();
  const sampleId = getDocumentId("blr-01", "det-surf-matic-front-1l");
  const doc = await client.get({
    index: TEST_INDEX,
    id: sampleId,
  });

  assert.equal(doc.body?.found, true);
  assert.equal(doc.body?._source?.name, "Surf Excel Matic Front Load Liquid Detergent");
  assert.equal(doc.body?._source?.storeId, "blr-01");
  assert.equal(doc.body?._source?.inventoryVersion, 1);
});

test("writeProjection enforces monotonic inventoryVersion on duplicate and equal-version writes", async () => {
  const sampleOffer: ProductOffer = {
    productId: "det-surf-matic-front-1l",
    storeId: "blr-01",
    city: "Bengaluru",
    name: "Surf Excel Matic Front Load Liquid Detergent",
    category: "Laundry & Detergents",
    purpose: "front-load-detergent",
    pricePaise: 28000,
    imageUrl: "/img.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: { machineType: "front-load" },
    available: true,
    inventoryVersion: 1, // Same version as already indexed
    checkedAt: new Date().toISOString(),
  };

  // Writing the same version must be marked as 'unchanged'
  const duplicateResult = await writeProjection([sampleOffer], {
    index: TEST_INDEX,
    refresh: "wait_for",
  });

  assert.equal(duplicateResult.appliedCount, 0);
  assert.equal(duplicateResult.unchangedCount, 1);
  assert.equal(duplicateResult.failureCount, 0);
  assert.equal(duplicateResult.items[0].status, "unchanged");
});

test("writeProjection rejects older-version writes without regressing indexed state", async () => {
  // First, advance version to 5
  const advancedOffer: ProductOffer = {
    productId: "bev-red-label-tea-500g",
    storeId: "blr-01",
    city: "Bengaluru",
    name: "Brooke Bond Red Label Strong Leaf Tea",
    category: "Tea & Beverages",
    purpose: "black-tea",
    pricePaise: 29000,
    imageUrl: "/img.webp",
    pack: { quantity: 500, unit: "g" },
    knownAttributes: {},
    available: true,
    inventoryVersion: 5,
    checkedAt: new Date().toISOString(),
  };

  const advanceRes = await writeProjection([advancedOffer], {
    index: TEST_INDEX,
    refresh: "wait_for",
  });
  assert.equal(advanceRes.appliedCount, 1);

  // Now, attempt an older version (e.g. version 3, such as a delayed Kafka event)
  const olderOffer: ProductOffer = {
    ...advancedOffer,
    name: "Outdated Regressed Name",
    inventoryVersion: 3,
  };

  const olderRes = await writeProjection([olderOffer], {
    index: TEST_INDEX,
    refresh: "wait_for",
  });

  assert.equal(olderRes.appliedCount, 0);
  assert.equal(olderRes.unchangedCount, 1);
  assert.equal(olderRes.failureCount, 0);
  assert.equal(olderRes.items[0].status, "unchanged");

  // Verify the stored document in OpenSearch was NOT regressed
  const client = getOpenSearchClient();
  const storedDoc = await client.get({
    index: TEST_INDEX,
    id: getDocumentId("blr-01", "bev-red-label-tea-500g"),
  });

  assert.equal(storedDoc.body?._source?.inventoryVersion, 5);
  assert.equal(storedDoc.body?._source?.name, "Brooke Bond Red Label Strong Leaf Tea");
});

test("writeProjection applies newer versions when versions advance monotonically", async () => {
  const newerOffer: ProductOffer = {
    productId: "bev-red-label-tea-500g",
    storeId: "blr-01",
    city: "Bengaluru",
    name: "Brooke Bond Red Label - Updated",
    category: "Tea & Beverages",
    purpose: "black-tea",
    pricePaise: 29500,
    imageUrl: "/img.webp",
    pack: { quantity: 500, unit: "g" },
    knownAttributes: {},
    available: true,
    inventoryVersion: 6, // 6 > 5
    checkedAt: new Date().toISOString(),
  };

  const res = await writeProjection([newerOffer], {
    index: TEST_INDEX,
    refresh: "wait_for",
  });

  assert.equal(res.appliedCount, 1);
  assert.equal(res.unchangedCount, 0);
  assert.equal(res.failureCount, 0);

  const client = getOpenSearchClient();
  const storedDoc = await client.get({
    index: TEST_INDEX,
    id: getDocumentId("blr-01", "bev-red-label-tea-500g"),
  });
  assert.equal(storedDoc.body?._source?.inventoryVersion, 6);
  assert.equal(storedDoc.body?._source?.pricePaise, 29500);
});

test("writeProjection identifies invalid documents and classifies failure as permanent", async () => {
  const invalidOffer = {
    productId: "", // Invalid: empty product ID
    storeId: "blr-01",
    name: "Invalid Item",
    pricePaise: -50, // Invalid: negative price
    inventoryVersion: NaN, // Invalid: NaN
  } as unknown as ProductOffer;

  const res = await writeProjection([invalidOffer], {
    index: TEST_INDEX,
  });

  assert.equal(res.appliedCount, 0);
  assert.equal(res.unchangedCount, 0);
  assert.equal(res.failureCount, 1);
  assert.equal(res.items[0].status, "failure");
  assert.equal(res.items[0].classification, "permanent");
  assert.match(res.items[0].error || "", /Validation error/);
});

test("writeProjection handles partial bulk mixtures (applied, unchanged, failure)", async () => {
  const validNew: ProductOffer = {
    productId: "oil-saffola-gold-1l",
    storeId: "blr-01",
    city: "Bengaluru",
    name: "Saffola Gold",
    category: "Cooking Oils & Ghee",
    purpose: "cooking-oil",
    pricePaise: 19500,
    imageUrl: "/img.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: {},
    available: true,
    inventoryVersion: 10, // Newer than 1
    checkedAt: new Date().toISOString(),
  };

  const equalVer: ProductOffer = {
    productId: "oil-fortune-sunflower-1l",
    storeId: "blr-01",
    city: "Bengaluru",
    name: "Fortune",
    category: "Cooking Oils & Ghee",
    purpose: "cooking-oil",
    pricePaise: 15500,
    imageUrl: "/img.webp",
    pack: { quantity: 1000, unit: "ml" },
    knownAttributes: {},
    available: true,
    inventoryVersion: 1, // Equal to already indexed
    checkedAt: new Date().toISOString(),
  };

  const invalidDoc = {
    productId: "",
    storeId: "blr-01",
    name: "Broken",
  } as unknown as ProductOffer;

  const mixedRes = await writeProjection([validNew, equalVer, invalidDoc], {
    index: TEST_INDEX,
    refresh: "wait_for",
  });

  assert.equal(mixedRes.appliedCount, 1);
  assert.equal(mixedRes.unchangedCount, 1);
  assert.equal(mixedRes.failureCount, 1);

  const appliedItem = mixedRes.items.find((i) => i.productId === "oil-saffola-gold-1l");
  const unchangedItem = mixedRes.items.find((i) => i.productId === "oil-fortune-sunflower-1l");
  const failedItem = mixedRes.items.find((i) => i.status === "failure");

  assert.equal(appliedItem?.status, "applied");
  assert.equal(unchangedItem?.status, "unchanged");
  assert.equal(failedItem?.classification, "permanent");
});
