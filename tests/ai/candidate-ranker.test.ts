import { describe, it, expect } from "vitest";
import { rankEligibleCandidates } from "../../ai/candidate-ranker";
import type { ProductOffer } from "../../server/contracts/catalog";
import type { ShopperIntent } from "../../ai/intent-schema";
import type { HardConstraintEvaluation } from "../../ai/hard-constraints";

function createCandidateWithEval(
  id: string,
  pricePaise: number,
  overrides: Partial<ProductOffer> = {},
  verifiedReasons: string[] = ["Within stated budget", "Available in stock"]
) {
  const offer: ProductOffer = {
    productId: id,
    storeId: "blr-01",
    city: "Bengaluru",
    name: `Product ${id}`,
    category: "Groceries",
    purpose: "tea",
    pricePaise,
    imageUrl: `/images/${id}.webp`,
    pack: { quantity: 500, unit: "g" },
    knownAttributes: { brand: "Tata Tea" },
    available: true,
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
    ...overrides,
  };

  const evaluation: HardConstraintEvaluation = {
    eligible: true,
    failureReasons: [],
    verifiedReasons,
  };

  return { offer, evaluation };
}

describe("Candidate Ranker - Deterministic Scoring and Capping", () => {
  it("caps recommendations at maximum 3 candidates", () => {
    const list = [
      createCandidateWithEval("p-1", 10000),
      createCandidateWithEval("p-2", 12000),
      createCandidateWithEval("p-3", 15000),
      createCandidateWithEval("p-4", 18000),
      createCandidateWithEval("p-5", 20000),
    ];

    const ranked = rankEligibleCandidates(list, { purpose: "tea" }, 3);
    expect(ranked).toHaveLength(3);
  });

  it("never returns more than 3 candidates even when caller requests 10", () => {
    const list = [
      createCandidateWithEval("p-1", 10000),
      createCandidateWithEval("p-2", 12000),
      createCandidateWithEval("p-3", 15000),
      createCandidateWithEval("p-4", 18000),
      createCandidateWithEval("p-5", 20000),
    ];

    const ranked = rankEligibleCandidates(list, { purpose: "tea" }, 10);
    expect(ranked).toHaveLength(3);
  });

  it("allows caller to request fewer than 3 candidates", () => {
    const list = [
      createCandidateWithEval("p-1", 10000),
      createCandidateWithEval("p-2", 12000),
      createCandidateWithEval("p-3", 15000),
      createCandidateWithEval("p-4", 18000),
    ];

    const ranked = rankEligibleCandidates(list, { purpose: "tea" }, 2);
    expect(ranked).toHaveLength(2);
  });

  it("handles non-positive limits safely", () => {
    const list = [
      createCandidateWithEval("p-1", 10000),
      createCandidateWithEval("p-2", 12000),
    ];

    const rankedZero = rankEligibleCandidates(list, { purpose: "tea" }, 0);
    expect(rankedZero).toHaveLength(0);

    const rankedNegative = rankEligibleCandidates(list, { purpose: "tea" }, -5);
    expect(rankedNegative).toHaveLength(0);
  });

  it("prioritizes candidates matching soft preferences", () => {
    const candidateRegular = createCandidateWithEval("p-regular", 20000, {
      name: "Regular Tea",
      description: "Normal CTC tea",
    });
    const candidateMasala = createCandidateWithEval("p-masala", 20000, {
      name: "Masala Chai Premium",
      description: "Infused with organic cardamom and ginger spices",
    });

    const intent: ShopperIntent = {
      purpose: "tea",
      preferences: ["masala", "spices"],
    };

    const ranked = rankEligibleCandidates([candidateRegular, candidateMasala], intent);
    expect(ranked[0].offer.productId).toBe("p-masala");
    expect(ranked[0].reasons.some((r) => r.includes("Matches preference: masala"))).toBe(true);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("deduplicates candidates by productId", () => {
    const candidate1 = createCandidateWithEval("p-duplicate", 15000);
    const candidate2 = createCandidateWithEval("p-duplicate", 15000); // duplicate ID

    const ranked = rankEligibleCandidates([candidate1, candidate2], {});
    expect(ranked).toHaveLength(1);
    expect(ranked[0].offer.productId).toBe("p-duplicate");
  });

  it("uses stable productId ascending as deterministic tie-breaker", () => {
    const candidateB = createCandidateWithEval("prod-b", 20000);
    const candidateA = createCandidateWithEval("prod-a", 20000);
    const candidateC = createCandidateWithEval("prod-c", 20000);

    const ranked = rankEligibleCandidates([candidateB, candidateC, candidateA], {});
    expect(ranked.map((r) => r.offer.productId)).toEqual(["prod-a", "prod-b", "prod-c"]);
  });

  it("includes only factual verified reasons with no hallucinated claims", () => {
    const candidate = createCandidateWithEval(
      "p-verified",
      25000,
      {
        name: "Eco Friendly Liquid",
        knownAttributes: { packaging: "recyclable" },
      },
      ["Within stated budget (₹250.00)", "Available in stock at Bengaluru (blr-01)"]
    );

    const intent: ShopperIntent = {
      purpose: "tea",
      preferences: ["eco friendly"],
    };

    const ranked = rankEligibleCandidates([candidate], intent);
    expect(ranked).toHaveLength(1);
    const reasons = ranked[0].reasons;
    expect(reasons).toContain("Within stated budget (₹250.00)");
    expect(reasons).toContain("Available in stock at Bengaluru (blr-01)");
    expect(reasons.some((r) => r.includes("Matches preference: eco friendly"))).toBe(true);
  });

  it("regression: ensures purpose match outranks cheaper unrelated products and matches hyphenated purposes", () => {
    const toorDal = createCandidateWithEval(
      "dal-500",
      9500, // ₹95
      { name: "Toor Dal", purpose: "toor-dal" },
      ["Available in stock", "Matches requested purpose 'Toor Dal'"]
    );

    const salt = createCandidateWithEval(
      "salt-1kg",
      2900, // ₹29 (cheaper!)
      { name: "Iodized Table Salt", purpose: "table-salt" },
      ["Available in stock"]
    );

    const intent: ShopperIntent = {
      purpose: "Toor Dal",
      maxPricePaise: 15000,
    };

    const ranked = rankEligibleCandidates([salt, toorDal], intent);
    expect(ranked[0].offer.productId).toBe("dal-500");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});

