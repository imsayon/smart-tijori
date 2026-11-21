import { describe, it, expect } from "vitest";
import { buildDiscoverySearchOptions } from "../../ai/query-builder";
import type { ShopperIntent } from "../../ai/intent-schema";
import { ValidationError } from "../../server/discovery/search-service";

describe("Discovery Search Query Builder from Intent", () => {
  it("maps valid intent fields to Discovery SearchOptions", () => {
    const intent: ShopperIntent = {
      purpose: "whole-wheat-atta",
      maxPricePaise: 30000,
    };

    const options = buildDiscoverySearchOptions(intent, {
      storeId: "blr-01",
      city: "Bengaluru",
      category: "Groceries",
      limit: 10,
    });

    expect(options.q).toBe("whole-wheat-atta");
    expect(options.maxPricePaise).toBe(30000);
    expect(options.storeId).toBe("blr-01");
    expect(options.city).toBe("Bengaluru");
    expect(options.category).toBe("Groceries");
    expect(options.limit).toBe(10);
  });

  it("handles empty intent gracefully with default limits", () => {
    const options = buildDiscoverySearchOptions({});

    expect(options.q).toBeUndefined();
    expect(options.maxPricePaise).toBeUndefined();
    expect(options.limit).toBe(24);
  });

  it("bounds and trims purpose to maximum 100 characters", () => {
    const longPurpose = "a".repeat(150);
    const intent: ShopperIntent = {
      purpose: longPurpose,
    };

    const options = buildDiscoverySearchOptions(intent);
    expect(options.q).toBeDefined();
    expect(options.q!.length).toBe(100);
  });

  it("caps candidate limit between 1 and 24", () => {
    const optionsOver = buildDiscoverySearchOptions({}, { limit: 100 });
    expect(optionsOver.limit).toBe(24);

    const optionsUnder = buildDiscoverySearchOptions({}, { limit: 0 });
    expect(optionsUnder.limit).toBe(1);
  });

  it("validates search options through Discovery's validateSearchOptions", () => {
    // Negative price should throw ValidationError
    expect(() => {
      buildDiscoverySearchOptions({
        maxPricePaise: -500,
      });
    }).toThrow(ValidationError);
  });
});

