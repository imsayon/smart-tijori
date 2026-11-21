import { describe, it, expect } from "vitest";
import type { Client } from "@opensearch-project/opensearch";
import type { ProductOffer } from "../../server/contracts/catalog";
import type { ProductFactsReader } from "../../server/contracts/facts";
import { DependencyUnavailableError } from "../../server/discovery/search-service";
import {
  retrieveCandidatesForIntent,
  findCandidatesFromShopperQuery,
} from "../../ai/retrieval-bridge";
import type { ShopperIntent } from "../../ai/intent-schema";
import { GeminiModelAdapter } from "../../ai/gemini-adapter";

// Sample fixture offers
const SAMPLE_OFFERS: ProductOffer[] = [
  {
    productId: "prod-tea-1",
    storeId: "blr-01",
    city: "Bengaluru",
    name: "Tata Tea Gold 500g",
    category: "Beverages",
    purpose: "tea",
    pricePaise: 25000, // ₹250
    imageUrl: "/images/tea1.webp",
    pack: { quantity: 500, unit: "g" },
    knownAttributes: { type: "leaf-tea", organic: "false" },
    available: true,
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
  },
  {
    productId: "prod-tea-2",
    storeId: "blr-01",
    city: "Bengaluru",
    name: "Tata Tea Premium 1kg",
    category: "Beverages",
    purpose: "tea",
    pricePaise: 45000, // ₹450
    imageUrl: "/images/tea2.webp",
    pack: { quantity: 1, unit: "kg" },
    knownAttributes: { type: "ctc", organic: "false" },
    available: true,
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
  },
  {
    productId: "prod-tea-expensive",
    storeId: "blr-01",
    city: "Bengaluru",
    name: "Exotic Darjeeling Tea 500g",
    category: "Beverages",
    purpose: "tea",
    pricePaise: 95000, // ₹950
    imageUrl: "/images/tea3.webp",
    pack: { quantity: 500, unit: "g" },
    knownAttributes: { type: "orthodox", organic: "true" },
    available: true,
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
  },
  {
    productId: "prod-tea-out-of-stock",
    storeId: "blr-01",
    city: "Bengaluru",
    name: "Tata Tea Elaichi 500g",
    category: "Beverages",
    purpose: "tea",
    pricePaise: 26000,
    imageUrl: "/images/tea4.webp",
    pack: { quantity: 500, unit: "g" },
    knownAttributes: { type: "flavoured" },
    available: false, // Out of stock!
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
  },
  {
    productId: "prod-tea-mysore",
    storeId: "mys-01", // Wrong store
    city: "Mysuru",
    name: "Tata Tea Gold 500g (Mysuru)",
    category: "Beverages",
    purpose: "tea",
    pricePaise: 25000,
    imageUrl: "/images/tea5.webp",
    pack: { quantity: 500, unit: "g" },
    knownAttributes: { type: "leaf-tea" },
    available: true,
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
  },
];

function createMockOpenSearchClient(hits: ProductOffer[]): Client {
  return {
    search: async () => ({
      body: {
        hits: {
          hits: hits.map((offer) => ({
            _id: `${offer.storeId}:${offer.productId}`,
            _source: {
              productId: offer.productId,
              storeId: offer.storeId,
              name: offer.name,
              purpose: offer.purpose,
            },
          })),
        },
      },
    }),
  } as unknown as Client;
}

function createControlledFactsReader(offers: ProductOffer[]): ProductFactsReader {
  const offerMap = new Map<string, ProductOffer>();
  for (const o of offers) {
    offerMap.set(`${o.storeId}:${o.productId}`, o);
  }

  return {
    readProductFacts: async (storeId: string, productIds: string[]) => {
      const results: ProductOffer[] = [];
      for (const id of productIds) {
        const found = offerMap.get(`${storeId}:${id}`);
        if (found) results.push(found);
      }
      return results;
    },
  };
}

describe("Intent-to-Retrieval Bridge", () => {
  const mockClient = createMockOpenSearchClient(SAMPLE_OFFERS);
  const factsReader = createControlledFactsReader(SAMPLE_OFFERS);

  it("retrieves and returns matching product candidates within budget and pack size", async () => {
    const intent: ShopperIntent = {
      purpose: "tea",
      maxPricePaise: 50000, // ₹500 budget
      minPack: { quantity: 500, unit: "g" },
    };

    const result = await retrieveCandidatesForIntent(intent, {
      storeId: "blr-01",
      client: mockClient,
      factsReader,
      limit: 3,
    });

    expect(result.mode).toBe("ai");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.length).toBeLessThanOrEqual(3);

    // Both prod-tea-1 (₹250) and prod-tea-2 (₹450) match
    const ids = result.candidates.map((c) => c.offer.productId);
    expect(ids).toContain("prod-tea-1");
    expect(ids).toContain("prod-tea-2");

    // The expensive tea (₹950) must NOT be included
    expect(ids).not.toContain("prod-tea-expensive");

    // Out of stock product must NOT be included
    expect(ids).not.toContain("prod-tea-out-of-stock");

    // Wrong branch must NOT be included
    expect(ids).not.toContain("prod-tea-mysore");

    // Verify factual reasons exist
    const firstCandidate = result.candidates[0];
    expect(firstCandidate.reasons.some((r) => r.includes("Within stated budget"))).toBe(true);
    expect(firstCandidate.reasons.some((r) => r.includes("Available in stock"))).toBe(true);
  });

  it("filters out product that is over budget", async () => {
    const intent: ShopperIntent = {
      purpose: "tea",
      maxPricePaise: 30000, // ₹300 max
    };

    const result = await retrieveCandidatesForIntent(intent, {
      storeId: "blr-01",
      client: mockClient,
      factsReader,
    });

    const ids = result.candidates.map((c) => c.offer.productId);
    expect(ids).toContain("prod-tea-1"); // ₹250 <= ₹300
    expect(ids).not.toContain("prod-tea-2"); // ₹450 > ₹300
    expect(ids).not.toContain("prod-tea-expensive"); // ₹950 > ₹300
  });

  it("filters out product where package is below minimum required", async () => {
    const intent: ShopperIntent = {
      purpose: "tea",
      minPack: { quantity: 1, unit: "kg" }, // 1kg required
    };

    const result = await retrieveCandidatesForIntent(intent, {
      storeId: "blr-01",
      client: mockClient,
      factsReader,
    });

    const ids = result.candidates.map((c) => c.offer.productId);
    // prod-tea-1 is 500g (< 1kg) -> filtered out
    expect(ids).not.toContain("prod-tea-1");
    // prod-tea-2 is 1kg (>= 1kg) -> qualified
    expect(ids).toContain("prod-tea-2");
  });

  it("filters out candidates with incompatible package units", async () => {
    const intent: ShopperIntent = {
      purpose: "tea",
      minPack: { quantity: 500, unit: "ml" }, // ml requested, but tea is in grams
    };

    const result = await retrieveCandidatesForIntent(intent, {
      storeId: "blr-01",
      client: mockClient,
      factsReader,
    });

    expect(result.candidates).toHaveLength(0);
    expect(result.totalEligible).toBe(0);
  });

  it("filters out candidates with missing or conflicting required attributes", async () => {
    const intent: ShopperIntent = {
      purpose: "tea",
      requiredAttributes: {
        type: "leaf-tea",
      },
    };

    const result = await retrieveCandidatesForIntent(intent, {
      storeId: "blr-01",
      client: mockClient,
      factsReader,
    });

    const ids = result.candidates.map((c) => c.offer.productId);
    expect(ids).toContain("prod-tea-1"); // type: leaf-tea
    expect(ids).not.toContain("prod-tea-2"); // type: ctc
  });

  it("filters out out-of-stock products and products from the wrong branch", async () => {
    const intent: ShopperIntent = {
      purpose: "tea",
    };

    const result = await retrieveCandidatesForIntent(intent, {
      storeId: "blr-01",
      client: mockClient,
      factsReader,
    });

    const ids = result.candidates.map((c) => c.offer.productId);
    expect(ids).not.toContain("prod-tea-out-of-stock");
    expect(ids).not.toContain("prod-tea-mysore");
  });

  it("deduplicates candidates when OpenSearch returns duplicate IDs", async () => {
    // OpenSearch mock returns duplicate hits for prod-tea-1
    const duplicateClient = createMockOpenSearchClient([SAMPLE_OFFERS[0], SAMPLE_OFFERS[0]]);

    const result = await retrieveCandidatesForIntent(
      { purpose: "tea" },
      {
        storeId: "blr-01",
        client: duplicateClient,
        factsReader,
      }
    );

    const occurrences = result.candidates.filter((c) => c.offer.productId === "prod-tea-1");
    expect(occurrences).toHaveLength(1);
  });

  it("handles missing product facts in facts reader gracefully", async () => {
    // Facts reader returns empty array (missing in PostgreSQL)
    const emptyFactsReader: ProductFactsReader = {
      readProductFacts: async () => [],
    };

    const result = await retrieveCandidatesForIntent(
      { purpose: "tea" },
      {
        storeId: "blr-01",
        client: mockClient,
        factsReader: emptyFactsReader,
      }
    );

    expect(result.candidates).toEqual([]);
    expect(result.totalEligible).toBe(0);
  });

  it("ZeroDeadEnd behavior: returns valid empty list preserving original intent when no match exists", async () => {
    const impossibleIntent: ShopperIntent = {
      purpose: "tea",
      maxPricePaise: 5000, // ₹50 (impossible budget)
    };

    const result = await retrieveCandidatesForIntent(impossibleIntent, {
      storeId: "blr-01",
      client: mockClient,
      factsReader,
    });

    expect(result.candidates).toEqual([]);
    expect(result.totalEligible).toBe(0);
    // Preserves original constraints
    expect(result.intent).toEqual(impossibleIntent);
  });

  it("propagates real search dependency failure as DependencyUnavailableError", async () => {
    const failingClient: Client = {
      search: async () => {
        throw new Error("Connection refused to OpenSearch cluster");
      },
    } as unknown as Client;

    await expect(
      retrieveCandidatesForIntent(
        { purpose: "tea" },
        {
          storeId: "blr-01",
          client: failingClient,
          factsReader,
        }
      )
    ).rejects.toThrow(DependencyUnavailableError);
  });

  it("propagates real facts reader failure as DependencyUnavailableError", async () => {
    const failingFactsReader: ProductFactsReader = {
      readProductFacts: async () => {
        throw new Error("PostgreSQL pool connection timeout");
      },
    };

    await expect(
      retrieveCandidatesForIntent(
        { purpose: "tea" },
        {
          storeId: "blr-01",
          client: mockClient,
          factsReader: failingFactsReader,
        }
      )
    ).rejects.toThrow(DependencyUnavailableError);
  });

  it("end-to-end: explicit constraints override conflicting model extraction", async () => {
    // Model adapter mock extracts ₹900 budget
    const mockModelAdapter = new GeminiModelAdapter({
      apiKey: "test-key",
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        purpose: "tea",
                        maxPricePaise: 90000, // ₹900 from model
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        ),
    });

    // Shopper explicitly specifies max ₹300 budget
    const result = await findCandidatesFromShopperQuery("Need good tea", {
      storeId: "blr-01",
      explicitConstraints: {
        maxPricePaise: 30000, // Explicit ₹300
      },
      modelAdapter: mockModelAdapter,
      client: mockClient,
      factsReader,
    });

    expect(result.intent.maxPricePaise).toBe(30000);
    const ids = result.candidates.map((c) => c.offer.productId);
    expect(ids).toContain("prod-tea-1"); // ₹250 <= ₹300
    expect(ids).not.toContain("prod-tea-2"); // ₹450 > ₹300
  });

  it("end-to-end: falls back to rules mode if Gemini fails", async () => {
    const failingModelAdapter = new GeminiModelAdapter({
      apiKey: "test-key",
      fetchFn: async () => new Response("Quota exceeded", { status: 429 }),
    });

    const result = await findCandidatesFromShopperQuery("I want tea", {
      storeId: "blr-01",
      explicitConstraints: {
        purpose: "tea",
        maxPricePaise: 30000,
      },
      modelAdapter: failingModelAdapter,
      allowRulesFallback: true,
      client: mockClient,
      factsReader,
    });

    expect(result.mode).toBe("rules");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].offer.productId).toBe("prod-tea-1");
  });
});
