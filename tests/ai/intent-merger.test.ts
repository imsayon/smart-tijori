import { describe, it, expect } from "vitest";
import { mergeShopperConstraints } from "../../ai/intent-merger";
import type { ShopperIntent, ExplicitShopperConstraints } from "../../ai/intent-schema";

describe("ShopperIntent Merger - Explicit Constraint Priority", () => {
  it("explicit budget overrides conflicting extracted model budget", () => {
    const extracted: ShopperIntent = {
      purpose: "tea",
      maxPricePaise: 30000, // ₹300 extracted by model
    };

    const explicit: ExplicitShopperConstraints = {
      maxPricePaise: 20000, // ₹200 explicitly set by shopper
    };

    const merged = mergeShopperConstraints(extracted, explicit);
    expect(merged.maxPricePaise).toBe(20000);
    expect(merged.purpose).toBe("tea");
  });

  it("explicit pack requirement overrides conflicting extracted model pack", () => {
    const extracted: ShopperIntent = {
      purpose: "liquid-detergent",
      minPack: { quantity: 1, unit: "l" },
    };

    const explicit: ExplicitShopperConstraints = {
      minPack: { quantity: 500, unit: "ml" },
    };

    const merged = mergeShopperConstraints(extracted, explicit);
    expect(merged.minPack).toEqual({ quantity: 500, unit: "ml" });
    expect(merged.purpose).toBe("liquid-detergent");
  });

  it("explicit purpose overrides extracted model purpose", () => {
    const extracted: ShopperIntent = {
      purpose: "beverage",
    };

    const explicit: ExplicitShopperConstraints = {
      purpose: "tea",
    };

    const merged = mergeShopperConstraints(extracted, explicit);
    expect(merged.purpose).toBe("tea");
  });

  it("merges required attributes, explicit keys override conflicting keys", () => {
    const extracted: ShopperIntent = {
      purpose: "detergent",
      requiredAttributes: {
        type: "top-load", // Model extracted top-load
        fragrance: "lavender", // Model extracted lavender
      },
    };

    const explicit: ExplicitShopperConstraints = {
      requiredAttributes: {
        type: "front-load", // Shopper explicitly specified front-load
        brand: "Surf Excel", // Shopper explicitly specified brand
      },
    };

    const merged = mergeShopperConstraints(extracted, explicit);
    expect(merged.requiredAttributes).toEqual({
      type: "front-load", // Overridden by explicit
      fragrance: "lavender", // Preserved from extracted
      brand: "Surf Excel", // Added from explicit
    });
  });

  it("prioritizes explicit preferences and deduplicates case-insensitively", () => {
    const extracted: ShopperIntent = {
      preferences: ["organic", "budget-friendly", "Masala"],
    };

    const explicit: ExplicitShopperConstraints = {
      preferences: ["Quick Delivery", "Organic"],
    };

    const merged = mergeShopperConstraints(extracted, explicit);
    expect(merged.preferences).toEqual([
      "Quick Delivery",
      "Organic", // Explicit casing preserved
      "budget-friendly",
      "Masala",
    ]);
  });

  it("handles missing extracted or missing explicit constraints gracefully", () => {
    // Case 1: extracted is null/undefined
    const explicitOnly = mergeShopperConstraints(null, { purpose: "rice", maxPricePaise: 15000 });
    expect(explicitOnly.purpose).toBe("rice");
    expect(explicitOnly.maxPricePaise).toBe(15000);

    // Case 2: explicit is null/undefined
    const extractedOnly = mergeShopperConstraints({ purpose: "oil", maxPricePaise: 22000 }, null);
    expect(extractedOnly.purpose).toBe("oil");
    expect(extractedOnly.maxPricePaise).toBe(22000);

    // Case 3: both null/undefined
    const bothEmpty = mergeShopperConstraints(undefined, undefined);
    expect(bothEmpty).toEqual({});
  });

  it("does not silently relax explicit constraints", () => {
    const extracted: ShopperIntent = {
      maxPricePaise: 50000, // relaxed price from model
    };

    const explicit: ExplicitShopperConstraints = {
      maxPricePaise: 10000, // strict budget from shopper
    };

    const merged = mergeShopperConstraints(extracted, explicit);
    expect(merged.maxPricePaise).toBe(10000);
  });
});
