import type { ProductOffer } from "../server/contracts/catalog";
import type { ShopperIntent } from "./intent-schema";

export interface HardConstraintEvaluation {
  eligible: boolean;
  failureReasons: string[];
  verifiedReasons: string[];
}

type UnitCategory = "mass" | "volume" | "count";

export function normalizePurpose(purpose?: string): string {
  if (!purpose) return "";
  return purpose
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function arePurposesCompatible(offerPurpose?: string, targetPurpose?: string): boolean {
  const normOffer = normalizePurpose(offerPurpose);
  const normTarget = normalizePurpose(targetPurpose);
  if (!normOffer || !normTarget) return false;

  if (normOffer === normTarget) return true;
  // Substring / phrase match (e.g. "front load detergent" vs "detergent" or "toor dal" vs "toor dal family pack")
  if (normOffer.includes(normTarget) || normTarget.includes(normOffer)) return true;

  // Check complete word token overlap
  const offerTokens = new Set(normOffer.split(" ").filter(Boolean));
  const targetTokens = normTarget.split(" ").filter(Boolean);
  if (targetTokens.length > 0 && targetTokens.every((t) => offerTokens.has(t))) {
    return true;
  }
  const targetTokensSet = new Set(targetTokens);
  if (offerTokens.size > 0 && Array.from(offerTokens).every((t) => targetTokensSet.has(t))) {
    return true;
  }

  return false;
}

function getUnitCategory(unit: string): { category: UnitCategory; scaleToBase: number } | null {
  switch (unit) {
    case "g":
      return { category: "mass", scaleToBase: 1 };
    case "kg":
      return { category: "mass", scaleToBase: 1000 };
    case "ml":
      return { category: "volume", scaleToBase: 1 };
    case "l":
      return { category: "volume", scaleToBase: 1000 };
    case "count":
      return { category: "count", scaleToBase: 1 };
    default:
      return null;
  }
}

export function evaluateHardConstraints(
  offer: ProductOffer,
  intent: ShopperIntent,
  requestedStoreId?: string,
  unavailableOffer?: ProductOffer
): HardConstraintEvaluation {
  const failureReasons: string[] = [];
  const verifiedReasons: string[] = [];

  // 1. Branch correctness
  if (requestedStoreId !== undefined && offer.storeId !== requestedStoreId) {
    failureReasons.push(
      `Product store '${offer.storeId}' does not match requested store '${requestedStoreId}'`
    );
  }

  // 2. Authoritative Availability
  const isAvailable =
    (typeof offer.available === "boolean" ? offer.available : (offer.available as number) > 0) &&
    (offer.availableStock === undefined || offer.availableStock > 0);

  if (!isAvailable) {
    failureReasons.push("Product is currently out of stock");
  } else {
    verifiedReasons.push("Available in stock");
  }

  // 3. Maximum budget
  if (intent.maxPricePaise !== undefined) {
    if (offer.pricePaise > intent.maxPricePaise) {
      failureReasons.push(
        `Product price ₹${(offer.pricePaise / 100).toFixed(
          2
        )} exceeds maximum budget of ₹${(intent.maxPricePaise / 100).toFixed(2)}`
      );
    } else {
      verifiedReasons.push(
        `Within stated budget (₹${(offer.pricePaise / 100).toFixed(2)})`
      );
    }
  }

  // 4. Minimum package size
  if (intent.minPack !== undefined) {
    if (!offer.pack || !offer.pack.unit || typeof offer.pack.quantity !== "number") {
      failureReasons.push("Missing verified package information for product");
    } else {
      const requiredUnitInfo = getUnitCategory(intent.minPack.unit);
      const offerUnitInfo = getUnitCategory(offer.pack.unit);

      if (!requiredUnitInfo || !offerUnitInfo || requiredUnitInfo.category !== offerUnitInfo.category) {
        failureReasons.push(
          `Package unit '${offer.pack.unit}' is incompatible with requested unit '${intent.minPack.unit}'`
        );
      } else {
        const requiredBase = intent.minPack.quantity * requiredUnitInfo.scaleToBase;
        const offerBase = offer.pack.quantity * offerUnitInfo.scaleToBase;

        if (offerBase < requiredBase) {
          failureReasons.push(
            `Package size ${offer.pack.quantity} ${offer.pack.unit} is smaller than minimum required ${intent.minPack.quantity} ${intent.minPack.unit}`
          );
        } else {
          verifiedReasons.push(
            `Meets minimum package size of ${intent.minPack.quantity} ${intent.minPack.unit} (${offer.pack.quantity} ${offer.pack.unit})`
          );
        }
      }
    }
  }

  // 5. Required attributes
  if (intent.requiredAttributes !== undefined) {
    for (const [attrKey, requiredValue] of Object.entries(intent.requiredAttributes)) {
      const knownAttrs = offer.knownAttributes;
      const actualValue = knownAttrs ? knownAttrs[attrKey] : undefined;

      if (actualValue === undefined || actualValue === null) {
        failureReasons.push(`Missing verified required attribute '${attrKey}'`);
      } else {
        const matches = Array.isArray(actualValue)
          ? actualValue.map(String).includes(String(requiredValue))
          : String(actualValue) === String(requiredValue);

        if (!matches) {
          failureReasons.push(
            `Attribute '${attrKey}' does not match required value '${requiredValue}'`
          );
        } else {
          verifiedReasons.push(`Matches requested ${attrKey}: ${requiredValue}`);
        }
      }
    }
  }

  // 6. Product Purpose compatibility (Strict Hard Constraint)
  const targetPurpose = intent.purpose || unavailableOffer?.purpose;
  if (targetPurpose) {
    const isCompatible =
      arePurposesCompatible(offer.purpose, targetPurpose) ||
      (unavailableOffer?.purpose ? arePurposesCompatible(offer.purpose, unavailableOffer.purpose) : false);

    if (!isCompatible) {
      failureReasons.push(
        `Product purpose '${offer.purpose}' is incompatible with requested purpose '${targetPurpose}'`
      );
    } else {
      verifiedReasons.push(`Matches requested purpose '${targetPurpose}'`);
    }
  }

  return {
    eligible: failureReasons.length === 0,
    failureReasons,
    verifiedReasons,
  };
}
