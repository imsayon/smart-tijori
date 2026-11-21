import assert from "node:assert/strict";
import test from "node:test";

test("the running application serves the shopper storefront", async () => {
  const response = await fetch(process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000", {
    signal: AbortSignal.timeout(10_000),
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="en"/);
  assert.match(html, /<title>SmartTijori<\/title>/);
  assert.match(html, /<main[ >]/);
  assert.match(html, /Current store/);
});
