import type { ShopperIntent } from "./intent-schema";
import {
  type SearchOptions,
  validateSearchOptions,
} from "../server/discovery/search-service";

export interface BuildSearchOptionsContext {
  storeId?: string;
  city?: string;
  category?: string;
  minPricePaise?: number;
  maxPricePaise?: number;
  limit?: number;
  includeUnavailable?: boolean;
}

export function buildDiscoverySearchOptions(
  intent: ShopperIntent,
  context?: BuildSearchOptionsContext
): SearchOptions {
  let q: string | undefined;

  if (intent.purpose !== undefined) {
    const trimmed = intent.purpose.trim();
    if (trimmed.length > 0) {
      q = trimmed.length > 100 ? trimmed.slice(0, 100) : trimmed;
    }
  }

  let limit = 24;
  if (context?.limit !== undefined) {
    limit = Math.min(Math.max(context.limit, 1), 24);
  }

  const options: SearchOptions = {
    q,
    maxPricePaise: intent.maxPricePaise ?? context?.maxPricePaise,
    minPricePaise: context?.minPricePaise,
    storeId: context?.storeId,
    city: context?.city,
    category: context?.category,
    limit,
    includeUnavailable: context?.includeUnavailable,
  };

  validateSearchOptions(options);

  return options;
}
