import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../client/app/api/products/route";

function createRequest(queryString: string): NextRequest {
  const url = `http://localhost:3000/api/products${queryString ? `?${queryString}` : ""}`;
  return new NextRequest(url);
}

test("GET /api/products returns 200 with items list for empty query", async () => {
  const req = createRequest("limit=5");
  const res = await GET(req);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.items));
  assert.equal(data.items.length, 5);
});

test("GET /api/products executes search and returns filtered results", async () => {
  const req = createRequest("q=Ariel&storeId=blr-01");
  const res = await GET(req);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.items.length > 0);
  assert.equal(data.items[0].productId, "det-ariel-matic-front-1l");
  assert.equal(data.items[0].storeId, "blr-01");
});

test("GET /api/products supports typo-tolerant queries", async () => {
  const req = createRequest("q=Surf%20Exel&storeId=mys-01");
  const res = await GET(req);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.items.length > 0);
  const found = data.items.some((i: { productId: string }) => i.productId === "det-surf-matic-front-1l");
  assert.ok(found, "Expected Surf Excel in typo search response");
});

test("regression: GET /api/products ranks Tata Tea above Tata Toor Dal for 'Tata Tea'", async () => {
  const req = createRequest("q=Tata%20Tea");
  const res = await GET(req);

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.items.length > 0);
  assert.equal(data.items[0].productId, "bev-tata-tea-premium-500g");
  assert.equal(data.items[0].category, "Tea & Beverages");

  const tataTeaIdx = data.items.findIndex((item: { productId: string }) => item.productId === "bev-tata-tea-premium-500g");
  const redLabelTeaIdx = data.items.findIndex((item: { productId: string }) => item.productId === "bev-red-label-tea-500g");
  const toorDalIdx = data.items.findIndex((item: { productId: string }) => item.productId === "stp-tata-sampann-toor-1kg");

  assert.ok(tataTeaIdx !== -1);
  if (toorDalIdx !== -1) {
    assert.ok(tataTeaIdx < toorDalIdx, "Tata Tea must rank above Tata Toor Dal");
    if (redLabelTeaIdx !== -1) {
      assert.ok(redLabelTeaIdx < toorDalIdx, "Red Label Tea must rank above Tata Toor Dal");
    }
  }
});

test("GET /api/products returns 400 VALIDATION_ERROR for negative limit", async () => {
  const req = createRequest("limit=-5");
  const res = await GET(req);

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error?.code, "VALIDATION_ERROR");
  assert.match(data.error?.message, /positive integer/);
});

test("GET /api/products returns 400 VALIDATION_ERROR for non-numeric price", async () => {
  const req = createRequest("minPrice=abc");
  const res = await GET(req);

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error?.code, "VALIDATION_ERROR");
  assert.match(data.error?.message, /non-negative number/);
});

test("GET /api/products returns 400 VALIDATION_ERROR for minPrice > maxPrice", async () => {
  const req = createRequest("minPrice=30000&maxPrice=10000");
  const res = await GET(req);

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error?.code, "VALIDATION_ERROR");
  assert.match(data.error?.message, /cannot be greater/);
});

test("GET /api/products returns 400 VALIDATION_ERROR for excessively long query", async () => {
  const longQ = "q=".concat("x".repeat(105));
  const req = createRequest(longQ);
  const res = await GET(req);

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error?.code, "VALIDATION_ERROR");
  assert.match(data.error?.message, /maximum length/);
});
