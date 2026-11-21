import { describe, it, expect } from "vitest";
import { evaluateHardConstraints } from "../../ai/hard-constraints";
import type { ProductOffer } from "../../server/contracts/catalog";
import type { ShopperIntent } from "../../ai/intent-schema";

function createSampleOffer(overrides: Partial<ProductOffer> = {}): ProductOffer {
  return {
    productId: "prod-001",
    storeId: "blr-01",
    city: "Bengaluru",
    name: "Aashirvaad Whole Wheat Atta 1kg",
    category: "Groceries",
    purpose: "whole-wheat-atta",
    pricePaise: 25000, // ₹250
    imageUrl: "/images/atta.webp",
    pack: { quantity: 1, unit: "kg" },
    knownAttributes: {
      type: "chakki-fresh",
      organic: "true",
      brand: "Aashirvaad",
    },
    available: true,
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Hard Constraints Evaluation", () => {
  it("qualifies a matching product that satisfies all constraints", () => {
    const offer = createSampleOffer();
    const intent: ShopperIntent = {
      purpose: "whole-wheat-atta",
      maxPricePaise: 30000,
      minPack: { quantity: 500, unit: "g" },
      requiredAttributes: {
        type: "chakki-fresh",
      },
    };

    const evalResult = evaluateHardConstraints(offer, intent, "blr-01");
    expect(evalResult.eligible).toBe(true);
    expect(evalResult.failureReasons).toHaveLength(0);
    expect(evalResult.verifiedReasons).toContain("Within stated budget (₹250.00)");
    expect(evalResult.verifiedReasons).toContain("Matches requested type: chakki-fresh");
    expect(evalResult.verifiedReasons.some((r) => r.includes("Meets minimum package size"))).toBe(true);
    expect(evalResult.verifiedReasons.some((r) => r.includes("Available in stock"))).toBe(true);
  });

  it("rejects candidate when product price exceeds max budget", () => {
    const offer = createSampleOffer({ pricePaise: 35000 }); // ₹350
    const intent: ShopperIntent = {
      maxPricePaise: 30000, // ₹300 max
    };

    const evalResult = evaluateHardConstraints(offer, intent);
    expect(evalResult.eligible).toBe(false);
    expect(evalResult.failureReasons.some((r) => r.includes("exceeds maximum budget"))).toBe(true);
  });

  it("rejects candidate when package size is below minimum required", () => {
    const offer = createSampleOffer({ pack: { quantity: 500, unit: "g" } });
    const intent: ShopperIntent = {
      minPack: { quantity: 1, unit: "kg" }, // 1kg = 1000g > 500g
    };

    const evalResult = evaluateHardConstraints(offer, intent);
    expect(evalResult.eligible).toBe(false);
    expect(evalResult.failureReasons.some((r) => r.includes("smaller than minimum required"))).toBe(true);
  });

  it("correctly handles compatible package units (g <-> kg, ml <-> l)", () => {
    // 500g required vs 1kg offer (1000g >= 500g) -> eligible
    const offerKg = createSampleOffer({ pack: { quantity: 1, unit: "kg" } });
    const intentG = { minPack: { quantity: 500, unit: "g" as const } };
    expect(evaluateHardConstraints(offerKg, intentG).eligible).toBe(true);

    // 500ml required vs 1l offer (1000ml >= 500ml) -> eligible
    const offerL = createSampleOffer({ pack: { quantity: 1, unit: "l" } });
    const intentMl = { minPack: { quantity: 500, unit: "ml" as const } };
    expect(evaluateHardConstraints(offerL, intentMl).eligible).toBe(true);

    // 2 count required vs 5 count offer -> eligible
    const offerCount = createSampleOffer({ pack: { quantity: 5, unit: "count" } });
    const intentCount = { minPack: { quantity: 2, unit: "count" as const } };
    expect(evaluateHardConstraints(offerCount, intentCount).eligible).toBe(true);
  });

  it("rejects candidate with incompatible package units (e.g. g vs ml, count vs kg)", () => {
    // Required 500g but candidate is 500ml
    const offerLiquid = createSampleOffer({ pack: { quantity: 500, unit: "ml" } });
    const intentSolid = { minPack: { quantity: 500, unit: "g" as const } };
    const res1 = evaluateHardConstraints(offerLiquid, intentSolid);
    expect(res1.eligible).toBe(false);
    expect(res1.failureReasons.some((r) => r.includes("is incompatible with requested unit"))).toBe(true);

    // Required 1 count but candidate is 1kg
    const offerKg = createSampleOffer({ pack: { quantity: 1, unit: "kg" } });
    const intentCount = { minPack: { quantity: 1, unit: "count" as const } };
    const res2 = evaluateHardConstraints(offerKg, intentCount);
    expect(res2.eligible).toBe(false);
    expect(res2.failureReasons.some((r) => r.includes("is incompatible with requested unit"))).toBe(true);
  });

  it("rejects candidate when required attribute is missing from knownAttributes", () => {
    const offer = createSampleOffer({
      knownAttributes: { brand: "Tata" }, // missing 'type'
    });
    const intent: ShopperIntent = {
      requiredAttributes: {
        type: "front-load",
      },
    };

    const evalResult = evaluateHardConstraints(offer, intent);
    expect(evalResult.eligible).toBe(false);
    expect(evalResult.failureReasons.some((r) => r.includes("Missing verified required attribute 'type'"))).toBe(true);
  });

  it("rejects candidate when required attribute value conflicts with verified facts", () => {
    const offer = createSampleOffer({
      knownAttributes: { type: "top-load" },
    });
    const intent: ShopperIntent = {
      requiredAttributes: {
        type: "front-load",
      },
    };

    const evalResult = evaluateHardConstraints(offer, intent);
    expect(evalResult.eligible).toBe(false);
    expect(evalResult.failureReasons.some((r) => r.includes("does not match required value 'front-load'"))).toBe(true);
  });

  it("rejects candidate when product is out of stock (available === false)", () => {
    const offer = createSampleOffer({ available: false });
    const evalResult = evaluateHardConstraints(offer, {});
    expect(evalResult.eligible).toBe(false);
    expect(evalResult.failureReasons.some((r) => r.includes("out of stock"))).toBe(true);
  });

  it("rejects candidate when product branch does not match requested storeId", () => {
    const offer = createSampleOffer({ storeId: "mys-01" });
    const evalResult = evaluateHardConstraints(offer, {}, "blr-01");
    expect(evalResult.eligible).toBe(false);
    expect(evalResult.failureReasons.some((r) => r.includes("does not match requested store"))).toBe(true);
  });
});
