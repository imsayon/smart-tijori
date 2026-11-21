import assert from "node:assert/strict";
import test from "node:test";
import {
  searchProducts,
  ValidationError,
  DependencyUnavailableError,
} from "../server/discovery/search-service";
import { FixtureProductFactsReader } from "../server/discovery/fixtures/catalog-fixture";
import type { ProductFactsReader } from "../server/contracts/facts";

test("exact product search returns relevant product", async () => {
  const result = await searchProducts({ q: "Tata Tea Premium", storeId: "mys-01" });
  assert.ok(result.items.length > 0);
  assert.equal(result.items[0].productId, "bev-tata-tea-premium-500g");
  assert.equal(result.items[0].storeId, "mys-01");
});

test("regression: searching for 'Tata Tea' without filters ranks actual tea products above Tata Toor Dal", async () => {
  const result = await searchProducts({ q: "Tata Tea" });
  assert.ok(result.items.length > 0);

  // Top result must be the exact phrase match Tata Tea
  const topItem = result.items[0];
  assert.equal(topItem.productId, "bev-tata-tea-premium-500g", "Top result must be Tata Tea");
  assert.equal(topItem.category, "Tea & Beverages");

  // Verify rank ordering of tea products vs Tata Toor Dal
  const tataTeaIdx = result.items.findIndex((item) => item.productId === "bev-tata-tea-premium-500g");
  const redLabelTeaIdx = result.items.findIndex((item) => item.productId === "bev-red-label-tea-500g");
  const toorDalIdx = result.items.findIndex((item) => item.productId === "stp-tata-sampann-toor-1kg");

  assert.ok(tataTeaIdx !== -1, "Tata Tea must be present in search results");
  assert.ok(redLabelTeaIdx !== -1, "Red Label Tea must be present in search results");

  if (toorDalIdx !== -1) {
    assert.ok(
      tataTeaIdx < toorDalIdx,
      `Tata Tea rank (${tataTeaIdx}) must be ahead of Tata Toor Dal rank (${toorDalIdx})`
    );
    assert.ok(
      redLabelTeaIdx < toorDalIdx,
      `Red Label Tea rank (${redLabelTeaIdx}) must be ahead of Tata Toor Dal rank (${toorDalIdx})`
    );
  }
});

test("regression: searching for 'Tata Tea' with storeId ranks Tata Tea first", async () => {
  const result = await searchProducts({ q: "Tata Tea", storeId: "blr-01" });
  assert.ok(result.items.length > 0);
  assert.equal(result.items[0].productId, "bev-tata-tea-premium-500g");
  assert.equal(result.items[0].category, "Tea & Beverages");

  const toorDalIdx = result.items.findIndex((item) => item.productId === "stp-tata-sampann-toor-1kg");
  if (toorDalIdx !== -1) {
    assert.ok(toorDalIdx > 0, "Tata Toor Dal must not rank higher than Tata Tea");
  }
});

test("partial product search matches edge n-grams and prefix words", async () => {
  const result = await searchProducts({ q: "Ariel", storeId: "blr-01" });
  assert.ok(result.items.length > 0);
  assert.equal(result.items[0].productId, "det-ariel-matic-front-1l");
});

test("typo-tolerant search matches intentional spelling mistakes ('Surf Exel' -> Surf Excel)", async () => {
  // In mys-01, Surf Excel is available: true
  const result = await searchProducts({ q: "Surf Exel", storeId: "mys-01" });
  assert.ok(result.items.length > 0, "Expected at least 1 match for 'Surf Exel'");
  const surfMatch = result.items.find((i) => i.productId === "det-surf-matic-front-1l");
  assert.ok(surfMatch, "Expected Surf Excel to be found via typo tolerance");
});

test("description search retrieves products by their descriptive attributes", async () => {
  const result = await searchProducts({ q: "robusta", storeId: "mys-01" });
  assert.ok(result.items.length > 0);
  assert.equal(result.items[0].productId, "bev-nescafe-classic-100g");
});

test("category filtering returns only products within specified category", async () => {
  const result = await searchProducts({ category: "Cooking Oils & Ghee", storeId: "blr-01" });
  assert.ok(result.items.length > 0);
  for (const item of result.items) {
    assert.equal(item.category, "Cooking Oils & Ghee");
  }
});

test("price filtering correctly restricts results to min and max boundaries", async () => {
  const minPaise = 15000;
  const maxPaise = 20000;
  const result = await searchProducts({
    minPricePaise: minPaise,
    maxPricePaise: maxPaise,
    storeId: "mys-01",
  });

  assert.ok(result.items.length > 0);
  for (const item of result.items) {
    assert.ok(
      item.pricePaise >= minPaise && item.pricePaise <= maxPaise,
      `Item price ${item.pricePaise} outside [${minPaise}, ${maxPaise}]`
    );
  }
});

test("city filtering restricts results to the requested city", async () => {
  const result = await searchProducts({ city: "Mysuru", limit: 10 });
  assert.ok(result.items.length > 0);
  for (const item of result.items) {
    assert.equal(item.city, "Mysuru");
    assert.equal(item.storeId, "mys-01");
  }
});

test("store/branch filtering restricts results to specific storeId", async () => {
  const result = await searchProducts({ storeId: "blr-01", limit: 10 });
  assert.ok(result.items.length > 0);
  for (const item of result.items) {
    assert.equal(item.storeId, "blr-01");
  }
});

test("result limit is respected and capped at 24", async () => {
  const resultSmall = await searchProducts({ limit: 3 });
  assert.equal(resultSmall.items.length, 3);

  const resultMax = await searchProducts({ limit: 50 }); // Above 24 must cap at 24
  assert.ok(resultMax.items.length <= 24);
});

test("current-facts hydration excludes missing products", async () => {
  // Mock facts reader that intentionally drops a product
  const mockReader: ProductFactsReader = {
    async readProductFacts(storeId: string, productIds: string[]) {
      // Intentionally omit 'bev-nescafe-classic-100g'
      const baseReader = new FixtureProductFactsReader();
      const all = await baseReader.readProductFacts(storeId, productIds);
      return all.filter((o) => o.productId !== "bev-nescafe-classic-100g");
    },
  };

  const result = await searchProducts({
    q: "Nescafe",
    storeId: "mys-01",
    factsReader: mockReader,
  });

  const nescafe = result.items.find((i) => i.productId === "bev-nescafe-classic-100g");
  assert.equal(nescafe, undefined, "Missing product should be excluded by facts reader");
});

test("current-facts hydration excludes unavailable products by default", async () => {
  // In blr-01, Surf Excel is seeded with available = false
  const result = await searchProducts({
    q: "Surf Excel",
    storeId: "blr-01",
    includeUnavailable: false,
  });

  const surf = result.items.find((i) => i.productId === "det-surf-matic-front-1l");
  assert.equal(surf, undefined, "Unavailable item in blr-01 must be excluded by facts hydration");

  // With includeUnavailable: true, it should be included
  const resultWithUnavail = await searchProducts({
    q: "Surf Excel",
    storeId: "blr-01",
    includeUnavailable: true,
  });
  const surfUnavail = resultWithUnavail.items.find((i) => i.productId === "det-surf-matic-front-1l");
  assert.ok(surfUnavail, "Should be present when includeUnavailable is true");
  assert.equal(surfUnavail?.available, false);
});

test("empty query returns catalog items up to limit", async () => {
  const result = await searchProducts({ limit: 5 });
  assert.equal(result.items.length, 5);
});

test("excessively long query (>100 chars) throws ValidationError", async () => {
  const longQuery = "a".repeat(101);
  await assert.rejects(
    async () => searchProducts({ q: longQuery }),
    (err: unknown) => err instanceof ValidationError && err.message.includes("exceeds maximum length")
  );
});

test("invalid price filters throw ValidationError", async () => {
  await assert.rejects(
    async () => searchProducts({ minPricePaise: -10 }),
    (err: unknown) => err instanceof ValidationError && err.message.includes("non-negative")
  );

  await assert.rejects(
    async () => searchProducts({ minPricePaise: 500, maxPricePaise: 200 }),
    (err: unknown) => err instanceof ValidationError && err.message.includes("cannot be greater")
  );
});

test("OpenSearch outage or non-existent index throws DependencyUnavailableError", async () => {
  await assert.rejects(
    async () => searchProducts({ index: "non_existent_smart_tijori_index_999" }),
    (err: unknown) => err instanceof DependencyUnavailableError
  );
});
