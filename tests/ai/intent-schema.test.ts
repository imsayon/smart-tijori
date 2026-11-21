import { describe, it, expect } from "vitest";
import {
  ShopperIntentSchema,
  MinPackSchema,
  MaxPricePaiseSchema,
  PackUnitSchema,
  parseShopperIntent,
  safeParseShopperIntent,
  type ShopperIntent,
} from "../../ai/intent-schema";

describe("ShopperIntent Schema Validation", () => {
  it("validates complete valid shopper intent", () => {
    const raw: ShopperIntent = {
      purpose: "whole-wheat-atta",
      maxPricePaise: 27500, // ₹275
      minPack: {
        quantity: 5,
        unit: "kg",
      },
      requiredAttributes: {
        organic: "true",
        brand: "Aashirvaad",
      },
      preferences: ["stone-ground", "fresh-milled"],
    };

    const parsed = parseShopperIntent(raw);
    expect(parsed.purpose).toBe("whole-wheat-atta");
    expect(parsed.maxPricePaise).toBe(27500);
    expect(parsed.minPack).toEqual({ quantity: 5, unit: "kg" });
    expect(parsed.requiredAttributes).toEqual({
      organic: "true",
      brand: "Aashirvaad",
    });
    expect(parsed.preferences).toEqual(["stone-ground", "fresh-milled"]);
  });

  it("preserves missing or unspecified fields as undefined (never invents)", () => {
    const raw = {
      purpose: "tea",
    };

    const parsed = parseShopperIntent(raw);
    expect(parsed.purpose).toBe("tea");
    expect(parsed.maxPricePaise).toBeUndefined();
    expect(parsed.minPack).toBeUndefined();
    expect(parsed.requiredAttributes).toBeUndefined();
    expect(parsed.preferences).toBeUndefined();
  });

  it("accepts an empty object as valid minimal intent", () => {
    const parsed = parseShopperIntent({});
    expect(parsed).toEqual({});
  });

  it("validates allowed pack units ('g', 'kg', 'ml', 'l', 'count')", () => {
    const allowed = ["g", "kg", "ml", "l", "count"] as const;
    for (const unit of allowed) {
      expect(PackUnitSchema.parse(unit)).toBe(unit);
      const minPack = MinPackSchema.parse({ quantity: 500, unit });
      expect(minPack.unit).toBe(unit);
    }
  });

  it("rejects unknown or unstandardized pack units", () => {
    const invalidUnits = ["boxes", "bottles", "packets", "litres", "grams", "lbs", "oz"];
    for (const unit of invalidUnits) {
      const result = MinPackSchema.safeParse({ quantity: 1, unit });
      expect(result.success).toBe(false);
    }
  });

  it("rejects non-positive or non-finite package quantities", () => {
    const invalidQuantities = [0, -1, -500, NaN, Infinity, -Infinity];
    for (const quantity of invalidQuantities) {
      const result = MinPackSchema.safeParse({ quantity, unit: "g" });
      expect(result.success).toBe(false);
    }
  });

  it("validates non-negative integer price constraints", () => {
    expect(MaxPricePaiseSchema.parse(0)).toBe(0);
    expect(MaxPricePaiseSchema.parse(25000)).toBe(25000);

    // Negative price must be rejected
    const negResult = MaxPricePaiseSchema.safeParse(-1);
    expect(negResult.success).toBe(false);

    // Non-integer paise must be rejected
    const floatResult = MaxPricePaiseSchema.safeParse(250.5);
    expect(floatResult.success).toBe(false);
  });

  it("enforces bounded string lengths and collection sizes", () => {
    // Purpose > 100 characters must fail
    const longPurpose = "a".repeat(101);
    const purposeRes = ShopperIntentSchema.safeParse({ purpose: longPurpose });
    expect(purposeRes.success).toBe(false);

    // Preferences > 10 items must fail
    const elevenPreferences = Array.from({ length: 11 }, (_, i) => `pref-${i}`);
    const prefRes = ShopperIntentSchema.safeParse({ preferences: elevenPreferences });
    expect(prefRes.success).toBe(false);

    // Preference string > 100 chars must fail
    const longPrefRes = ShopperIntentSchema.safeParse({ preferences: ["a".repeat(101)] });
    expect(longPrefRes.success).toBe(false);

    // Required attributes > 20 entries must fail
    const twentyOneAttrs: Record<string, string> = {};
    for (let i = 0; i < 21; i++) {
      twentyOneAttrs[`key_${i}`] = `val_${i}`;
    }
    const attrRes = ShopperIntentSchema.safeParse({ requiredAttributes: twentyOneAttrs });
    expect(attrRes.success).toBe(false);
  });

  it("strictly rejects unknown unexpected top-level fields", () => {
    const hostilePayload = {
      purpose: "detergent",
      opensearchQuery: { match_all: {} }, // Hostile field injection
      executeCommand: "drop database",
    };

    const res = safeParseShopperIntent(hostilePayload);
    expect(res.success).toBe(false);
  });
});
