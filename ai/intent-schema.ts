import { z } from "zod";

export const PackUnitSchema = z.enum(["g", "kg", "ml", "l", "count"]);
export type PackUnit = z.infer<typeof PackUnitSchema>;

export const MinPackSchema = z
  .object({
    quantity: z.number().positive().finite(),
    unit: PackUnitSchema,
  })
  .strict();
export type MinPack = z.infer<typeof MinPackSchema>;

export const MaxPricePaiseSchema = z.number().int().nonnegative();

const NullableToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === null ? undefined : val), schema.optional());

export const ShopperIntentSchema = z
  .object({
    purpose: NullableToUndefined(z.string().max(100)),
    maxPricePaise: NullableToUndefined(MaxPricePaiseSchema),
    maxPriceMinor: NullableToUndefined(MaxPricePaiseSchema),
    minPack: NullableToUndefined(MinPackSchema),
    minPackUnits: NullableToUndefined(
      z.union([MinPackSchema, z.number().positive().finite()])
    ),
    requiredAttributes: NullableToUndefined(
      z
        .record(z.string(), z.string())
        .refine((obj) => Object.keys(obj).length <= 20, {
          message: "requiredAttributes cannot contain more than 20 entries",
        })
    ),
    preferences: NullableToUndefined(
      z.array(z.string().max(100)).max(10, {
        message: "preferences cannot contain more than 10 entries",
      })
    ),
  })
  .strict();

export type ShopperIntent = {
  purpose?: string;
  maxPricePaise?: number;
  minPack?: MinPack;
  requiredAttributes?: Record<string, string>;
  preferences?: string[];
};

export type ExplicitShopperConstraints = Partial<ShopperIntent> & {
  maxPriceMinor?: number;
  minPackUnits?: MinPack | number;
};

export function parseShopperIntent(raw: unknown): ShopperIntent {
  const parsed = ShopperIntentSchema.parse(raw);
  const clean: ShopperIntent = {};
  if (parsed.purpose !== undefined) clean.purpose = parsed.purpose;
  const maxPrice = parsed.maxPricePaise ?? parsed.maxPriceMinor;
  if (maxPrice !== undefined) clean.maxPricePaise = maxPrice;
  let minPack = parsed.minPack;
  if (!minPack && parsed.minPackUnits) {
    if (typeof parsed.minPackUnits === "object") {
      minPack = parsed.minPackUnits;
    }
  }
  if (minPack !== undefined) clean.minPack = minPack;
  if (parsed.requiredAttributes !== undefined) clean.requiredAttributes = parsed.requiredAttributes;
  if (parsed.preferences !== undefined) clean.preferences = parsed.preferences;
  return clean;
}

export type SafeParseShopperIntentResult =
  | { success: true; data: ShopperIntent }
  | { success: false; error: z.ZodError };

export function safeParseShopperIntent(raw: unknown): SafeParseShopperIntentResult {
  const result = ShopperIntentSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }
  return {
    success: true,
    data: parseShopperIntent(result.data),
  };
}
