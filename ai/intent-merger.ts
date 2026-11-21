import type {
  ShopperIntent,
  ExplicitShopperConstraints,
  MinPack,
} from "./intent-schema";

export function mergeShopperConstraints(
  extracted?: ShopperIntent | null,
  explicit?: ExplicitShopperConstraints | null
): ShopperIntent {
  const merged: ShopperIntent = {};

  const purpose = explicit?.purpose ?? extracted?.purpose;
  if (purpose !== undefined) {
    merged.purpose = purpose;
  }

  const explicitMaxPrice =
    explicit?.maxPricePaise ??
    (explicit as { maxPriceMinor?: number } | null | undefined)?.maxPriceMinor;
  const maxPricePaise = explicitMaxPrice ?? extracted?.maxPricePaise;
  if (maxPricePaise !== undefined) {
    merged.maxPricePaise = maxPricePaise;
  }

  const explicitMinPack =
    explicit?.minPack ??
    (typeof (explicit as { minPackUnits?: unknown } | null | undefined)?.minPackUnits === "object"
      ? ((explicit as { minPackUnits?: unknown })?.minPackUnits as MinPack | undefined)
      : undefined);
  const minPack = explicitMinPack ?? extracted?.minPack;
  if (minPack !== undefined) {
    merged.minPack = minPack;
  }

  const extractedAttrs = extracted?.requiredAttributes;
  const explicitAttrs = explicit?.requiredAttributes;
  if (extractedAttrs || explicitAttrs) {
    merged.requiredAttributes = {
      ...(extractedAttrs ?? {}),
      ...(explicitAttrs ?? {}),
    };
  }

  const explicitPrefs = explicit?.preferences;
  const extractedPrefs = extracted?.preferences;
  if ((explicitPrefs && explicitPrefs.length > 0) || (extractedPrefs && extractedPrefs.length > 0)) {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const p of explicitPrefs ?? []) {
      const lower = p.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(p);
      }
    }

    for (const p of extractedPrefs ?? []) {
      const lower = p.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(p);
      }
    }

    merged.preferences = result;
  }

  return merged;
}
