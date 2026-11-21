import fs from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadEnvironment } from "@/server/discovery/opensearch-client";
import { handlePostRecovery } from "@/server/http/routes/recovery-handler";
import { setCommerceCommands } from "@/server/http/adapters";
import { postgresCommerce } from "@/server/http/adapters/postgres-commerce";
import { findCandidatesFromShopperQuery } from "../../ai/retrieval-bridge";
import { getOpenSearchClient } from "@/server/discovery/opensearch-client";
import { getPostgresProductFactsReader } from "@/server/discovery/postgres-product-facts-reader";
import type { RecoveryResult } from "@/contracts";

// Load configuration for live testing
loadEnvironment();

const caCertCandidate = "C:\\dev\\smart-tijori\\secrets\\aiven-ca.pem";
if (!process.env.DATABASE_CA_CERT_PATH && fs.existsSync(caCertCandidate)) {
  process.env.DATABASE_CA_CERT_PATH = caCertCandidate;
}
if (!process.env.ST_DB_SCHEMA) {
  process.env.ST_DB_SCHEMA = "st_platform_verify_v1";
}
if (!process.env.OPENSEARCH_INDEX) {
  process.env.OPENSEARCH_INDEX = "smart_tijori_products_render_v1";
}

const isConfigured = Boolean(
  process.env.GEMINI_API_KEY &&
  process.env.OPENSEARCH_URL &&
  process.env.DATABASE_URL &&
  process.env.DATABASE_CA_CERT_PATH &&
  fs.existsSync(process.env.DATABASE_CA_CERT_PATH)
);

describe("Stage 4A: Live AI Recovery Integration Test (Read-Only)", () => {
  beforeAll(() => {
    if (isConfigured) {
      setCommerceCommands(postgresCommerce());
    }
  });

  afterAll(async () => {
    setCommerceCommands(null);
  });

  it(
    "exercises live Gemini, OpenSearch, and PostgreSQL facts in the end-to-end recovery pipeline",
    async (ctx) => {
      if (!isConfigured) {
        ctx.skip();
        return;
      }

      const mutableEnv = process.env as Record<string, string | undefined>;
      const prevNodeEnv = mutableEnv.NODE_ENV;
      // Set to 'production' to ensure recovery-handler uses live OpenSearch & PG facts reader rather than injected test mocks
      mutableEnv.NODE_ENV = "production";

      try {
        const storeId = "blr-01";
        const unavailableProductId = "dal-1kg";
        const shopperText = "I need at least 500g Toor Dal under 150 rupees";

        const request = new Request("http://localhost:3000/api/recovery", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Sec-Fetch-Site": "same-origin",
          },
          body: JSON.stringify({
            storeId,
            unavailableProductId,
            text: shopperText,
          }),
        });

        const response = await handlePostRecovery(request);
        expect(response.status).toBe(200);

        const data = (await response.json()) as RecoveryResult;

        // 1. Verify Gemini live intent extraction
        expect(data.mode).toBe("ai");
        expect(data.constraints.purpose).toMatch(/toor.*dal/i);
        expect(data.constraints.maxPricePaise).toBeLessThanOrEqual(15000); // <= ₹150
        expect(data.constraints.minPack?.quantity).toBeGreaterThanOrEqual(500);
        expect(data.constraints.minPack?.unit).toBe("g");

        // 2. Verify candidate constraints and ranking
        expect(Array.isArray(data.candidates)).toBe(true);
        expect(data.candidates.length).toBeGreaterThan(0);
        expect(data.candidates.length).toBeLessThanOrEqual(3);

        // 3. Verify unavailable product is NOT returned as an eligible alternative
        const returnedProductIds = data.candidates.map((c) => c.offer.productId);
        expect(returnedProductIds).not.toContain(unavailableProductId);
        // Ensure unrelated products like salt-1kg are strictly excluded by hard purpose constraint
        expect(returnedProductIds).not.toContain("salt-1kg");

        // 4. Verify candidate business invariants
        for (const candidate of data.candidates) {
          // Must belong to the requested store
          expect(candidate.offer.storeId).toBe(storeId);

          // Must be in stock according to authoritative PostgreSQL facts
          expect(Number(candidate.offer.available)).toBeGreaterThan(0);

          // Must respect hard price ceiling (₹150 = 15000 paise)
          expect(candidate.offer.pricePaise).toBeLessThanOrEqual(15000);

          // Must contain comparative reasons
          expect(candidate.reasons.length).toBeGreaterThan(0);
          expect(candidate.reasons.some((r) => r.includes("in stock"))).toBe(true);
        }

        // 5. Verify the expected available alternative (dal-500) is among the recommended candidates
        expect(returnedProductIds).toContain("dal-500");
        const dalCandidate = data.candidates.find((c) => c.offer.productId === "dal-500");
        expect(dalCandidate?.offer.name).toBe("Toor Dal");
        expect(dalCandidate?.offer.pricePaise).toBe(9500); // ₹95
      } finally {
        mutableEnv.NODE_ENV = prevNodeEnv;
      }
    },
    30_000
  );

  it(
    "demonstrates that dependency failure is reported honestly (HTTP 503) and not converted to empty success",
    async (ctx) => {
      if (!isConfigured) {
        ctx.skip();
        return;
      }

      const mutableEnv = process.env as Record<string, string | undefined>;
      const prevNodeEnv = mutableEnv.NODE_ENV;
      mutableEnv.NODE_ENV = "production";

      // Simulate an unreachable OpenSearch index
      const client = getOpenSearchClient();
      const factsReader = getPostgresProductFactsReader();

      try {
        await expect(
          findCandidatesFromShopperQuery("I need Toor Dal under 150 rupees", {
            storeId: "blr-01",
            unavailableProductId: "dal-1kg",
            index: "non_existent_opensearch_index_safeguard_test",
            client,
            factsReader,
            allowRulesFallback: false,
          })
        ).rejects.toThrow(/does not exist|unavailable/i);
      } finally {
        mutableEnv.NODE_ENV = prevNodeEnv;
      }
    },
    30_000
  );
});
