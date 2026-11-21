import type { Client } from "@opensearch-project/opensearch";
import type { ProductOffer } from "../server/contracts/catalog";
import type { ProductFactsReader } from "../server/contracts/facts";
import { searchProducts } from "../server/discovery/search-service";
import {
  parseShopperIntent,
  type ShopperIntent,
  type ExplicitShopperConstraints,
} from "./intent-schema";
import { mergeShopperConstraints } from "./intent-merger";
import {
  GeminiModelAdapter,
  getGeminiAdapter,
} from "./gemini-adapter";
import { buildDiscoverySearchOptions } from "./query-builder";
import { evaluateHardConstraints } from "./hard-constraints";
import {
  rankEligibleCandidates,
  type CandidateRecommendation,
  type CandidateWithEvaluation,
} from "./candidate-ranker";

export interface RetrieveCandidatesOptions {
  storeId: string;
  client?: Client;
  factsReader?: ProductFactsReader;
  limit?: number;
  category?: string;
  city?: string;
  includeUnavailable?: boolean;
  unavailableOffer?: ProductOffer;
  unavailableProductId?: string;
  explicitConstraints?: ExplicitShopperConstraints;
  mode?: "ai" | "rules";
  index?: string;
}

export interface RetrievalResult {
  mode: "ai" | "rules";
  intent: ShopperIntent;
  constraints: ShopperIntent;
  candidates: CandidateRecommendation[];
  totalEligible: number;
  checkedAt: string;
}

export interface FindCandidatesOptions extends RetrieveCandidatesOptions {
  modelAdapter?: GeminiModelAdapter;
  allowRulesFallback?: boolean;
}

export async function retrieveCandidatesForIntent(
  intent: ShopperIntent,
  options: RetrieveCandidatesOptions
): Promise<RetrievalResult> {
  const mode = options.mode ?? "ai";
  const mergedIntent = options.explicitConstraints
    ? mergeShopperConstraints(intent, options.explicitConstraints)
    : intent;

  const searchOptions = buildDiscoverySearchOptions(mergedIntent, {
    storeId: options.storeId,
    city: options.city,
    category: options.category,
    limit: 24,
    includeUnavailable: true,
  });

  const rawEnvIndex = process.env.OPENSEARCH_INDEX?.trim();
  const rawOptIndex = options.index?.trim();
  const effectiveIndex =
    (rawOptIndex && rawOptIndex.length > 0 ? rawOptIndex : undefined) ??
    (rawEnvIndex && rawEnvIndex.length > 0 ? rawEnvIndex : undefined) ??
    "smart_tijori_products";

  const searchResult = await searchProducts({
    ...searchOptions,
    index: effectiveIndex,
    client: options.client,
    factsReader: options.factsReader,
  });

  const evaluated: CandidateWithEvaluation[] = [];

  for (const offer of searchResult.items) {
    if (options.unavailableOffer && offer.productId === options.unavailableOffer.productId) {
      continue;
    }
    if (options.unavailableProductId && offer.productId === options.unavailableProductId) {
      continue;
    }

    const evaluation = evaluateHardConstraints(
      offer,
      mergedIntent,
      options.storeId,
      options.unavailableOffer
    );
    evaluated.push({ offer, evaluation });
  }

  const eligibleCount = evaluated.filter((e) => e.evaluation.eligible).length;
  const ranked = rankEligibleCandidates(evaluated, mergedIntent, options.limit ?? 3);

  return {
    mode,
    intent: mergedIntent,
    constraints: mergedIntent,
    candidates: ranked,
    totalEligible: eligibleCount,
    checkedAt: new Date().toISOString(),
  };
}

export async function findCandidatesFromShopperQuery(
  query: string,
  options: FindCandidatesOptions
): Promise<RetrievalResult> {
  const adapter = options.modelAdapter ?? getGeminiAdapter();
  const trimmedQuery = typeof query === "string" ? query.trim() : "";

  // 1. If query is non-empty, attempt model extraction
  if (trimmedQuery.length > 0) {
    try {
      const intent = await adapter.extractIntent(trimmedQuery, {
        explicitConstraints: options.explicitConstraints,
      });

      return await retrieveCandidatesForIntent(intent, {
        ...options,
        mode: "ai",
      });
    } catch (err: unknown) {
      if (!options.allowRulesFallback) {
        throw err;
      }
      // Clean fallback to Rules Mode below
    }
  }

  // 2. Rules Mode fallback (or empty query)
  const fallbackIntent: ShopperIntent = options.explicitConstraints
    ? parseShopperIntent(options.explicitConstraints)
    : {};

  if (!fallbackIntent.purpose && options.unavailableOffer?.purpose) {
    fallbackIntent.purpose = options.unavailableOffer.purpose;
  }
  if (!fallbackIntent.minPack && options.unavailableOffer?.pack) {
    const u = options.unavailableOffer.pack.unit;
    if (u === "g" || u === "kg" || u === "ml" || u === "l" || u === "count") {
      fallbackIntent.minPack = { quantity: options.unavailableOffer.pack.quantity, unit: u };
    }
  }
  const offerAttrs = options.unavailableOffer?.knownAttributes ?? (options.unavailableOffer as unknown as { attributes?: Record<string, string> })?.attributes;
  if (!fallbackIntent.requiredAttributes && offerAttrs) {
    fallbackIntent.requiredAttributes = offerAttrs as Record<string, string>;
  }

  return await retrieveCandidatesForIntent(fallbackIntent, {
    ...options,
    mode: "rules",
  });
}
