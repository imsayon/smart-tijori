import assert from "node:assert/strict";
import test from "node:test";
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

function getProducts(queryString: string) {
  return fetch(new URL(`/api/products?${queryString}`, baseUrl));
}

for (const [storeId, city] of [["blr-01", "Bengaluru"], ["mys-01", "Mysuru"]]) {
  test(`serves current offers with only the requested branch and city (${storeId})`, async () => {
    const res = await getProducts(`storeId=${storeId}&city=${city}&q=Sona%20Masuri`);
    assert.equal(res.status, 200);
    const { items } = await res.json();
    assert.ok(items.some((item: { productId: string }) => item.productId === "rice-1kg"));
    for (const item of items) {
      assert.equal(item.storeId, storeId);
      assert.equal(item.city, city);
      assert.ok(item.available > 0);
    }
  });
}

test("GET /api/products matches misspellings with branch, category and price filters", async () => {
  const res = await getProducts("q=Frnt%20Lod&storeId=mys-01&category=household&maxPricePaise=24900");
  assert.equal(res.status, 200);
  const { items } = await res.json();
  assert.ok(items.some((item: { productId: string }) => item.productId === "detergent-front-1l"));
  for (const item of items) {
    assert.equal(item.storeId, "mys-01");
    assert.equal(item.category, "household");
    assert.ok(item.pricePaise <= 24900);
  }
});

test("GET /api/products applies inclusive price bounds to current prices", async () => {
  const res = await getProducts("storeId=mys-01&minPricePaise=7500&maxPricePaise=7500");
  assert.equal(res.status, 200);
  const { items } = await res.json();
  assert.ok(items.some((item: { productId: string }) => item.productId === "rice-1kg"));
  for (const item of items) assert.equal(item.pricePaise, 7500);
});

test("GET /api/products excludes zero stock unless requested", async () => {
  for (const includeUnavailable of [false, true]) {
    const res = await getProducts(`storeId=mys-01&includeUnavailable=${includeUnavailable}`);
    assert.equal(res.status, 200);
    const { items } = await res.json();
    const unavailable = items.find((item: { productId: string }) => item.productId === "detergent-front-15l");
    assert.ok(items.length > 0 && items.length <= 24);
    assert.equal(unavailable?.available, includeUnavailable ? 0 : undefined);
  }
});

test("GET /api/products returns no offers for conflicting branch and city", async () => {
  const res = await getProducts("storeId=blr-01&city=Mysuru");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { items: [] });
});

test("GET /api/products returns the requested limit within the 24-offer cap", async () => {
  for (const [limit, expectedCount] of [[1, 1], [48, 24]]) {
    const res = await getProducts(`limit=${limit}`);
    assert.equal(res.status, 200);
    const { items } = await res.json();
    assert.equal(items.length, expectedCount);
  }
});

test("GET /api/products returns 400 VALIDATION_ERROR for negative limit", async () => {
  const res = await getProducts("limit=-5");

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error?.code, "VALIDATION_ERROR");
  assert.match(data.error?.message, /positive integer/);
});

test("GET /api/products returns 400 VALIDATION_ERROR for non-numeric price", async () => {
  const res = await getProducts("minPrice=abc");

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error?.code, "VALIDATION_ERROR");
  assert.match(data.error?.message, /non-negative number/);
});

test("GET /api/products returns 400 VALIDATION_ERROR for minPrice > maxPrice", async () => {
  const res = await getProducts("minPrice=30000&maxPrice=10000");

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error?.code, "VALIDATION_ERROR");
  assert.match(data.error?.message, /cannot be greater/);
});

test("GET /api/products returns 400 VALIDATION_ERROR for excessively long query", async () => {
  const longQ = "q=".concat("x".repeat(105));
  const res = await getProducts(longQ);

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error?.code, "VALIDATION_ERROR");
  assert.match(data.error?.message, /maximum length/);
});
