import type { Client } from "@opensearch-project/opensearch";
import type { ProductOffer } from "../contracts/catalog";
import type { ProductFactsReader } from "../contracts/facts";
import { getOpenSearchClient, getOpenSearchConfig } from "./opensearch-client";
import { FixtureProductFactsReader } from "./fixtures/catalog-fixture";

export interface SearchOptions {
  q?: string;
  category?: string;
  minPricePaise?: number;
  maxPricePaise?: number;
  city?: string;
  storeId?: string;
  limit?: number;
  includeUnavailable?: boolean;
  factsReader?: ProductFactsReader;
  client?: Client;
  index?: string;
}

export interface SearchResult {
  items: ProductOffer[];
  total: number;
}

export class ValidationError extends Error {
  public readonly code = "VALIDATION_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class DependencyUnavailableError extends Error {
  public readonly code = "DEPENDENCY_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "DependencyUnavailableError";
  }
}

/**
 * Validates and bounds query input to protect against injection,
 * oversized payloads, and nonsensical parameter ranges.
 */
export function validateSearchOptions(options: SearchOptions): void {
  if (options.q !== undefined) {
    if (typeof options.q !== "string") {
      throw new ValidationError("Query parameter 'q' must be a string");
    }
    if (options.q.length > 100) {
      throw new ValidationError("Query parameter 'q' exceeds maximum length of 100 characters");
    }
  }

  if (options.category !== undefined) {
    if (typeof options.category !== "string" || options.category.length > 50) {
      throw new ValidationError("Category filter exceeds maximum length of 50 characters");
    }
  }

  if (options.city !== undefined) {
    if (typeof options.city !== "string" || options.city.length > 50) {
      throw new ValidationError("City filter exceeds maximum length of 50 characters");
    }
  }

  if (options.storeId !== undefined) {
    if (typeof options.storeId !== "string" || options.storeId.length > 50) {
      throw new ValidationError("StoreId filter exceeds maximum length of 50 characters");
    }
  }

  if (options.minPricePaise !== undefined) {
    if (
      typeof options.minPricePaise !== "number" ||
      isNaN(options.minPricePaise) ||
      options.minPricePaise < 0
    ) {
      throw new ValidationError("minPricePaise must be a non-negative number");
    }
  }

  if (options.maxPricePaise !== undefined) {
    if (
      typeof options.maxPricePaise !== "number" ||
      isNaN(options.maxPricePaise) ||
      options.maxPricePaise < 0
    ) {
      throw new ValidationError("maxPricePaise must be a non-negative number");
    }
  }

  if (
    options.minPricePaise !== undefined &&
    options.maxPricePaise !== undefined &&
    options.minPricePaise > options.maxPricePaise
  ) {
    throw new ValidationError("minPricePaise cannot be greater than maxPricePaise");
  }

  if (options.limit !== undefined) {
    if (
      typeof options.limit !== "number" ||
      isNaN(options.limit) ||
      options.limit <= 0 ||
      !Number.isInteger(options.limit)
    ) {
      throw new ValidationError("limit must be a positive integer");
    }
  }
}

/**
 * Builds safe OpenSearch query DSL.
 * Uses typo-tolerant multi_match with fuzzy matching and edge n-grams.
 */
export function buildOpenSearchQuery(options: SearchOptions): Record<string, unknown> {
  const must: Record<string, unknown>[] = [];
  const filter: Record<string, unknown>[] = [];

  const rawQ = options.q?.trim();
  if (rawQ && rawQ.length > 0) {
    const should: Record<string, unknown>[] = [
      // 1. Complete search phrase match in product name (highest priority)
      {
        match_phrase: {
          name: {
            query: rawQ,
            boost: 25,
            slop: 1,
          },
        },
      },
      // 2. Phrase match on product purpose
      {
        match_phrase: {
          purpose: {
            query: rawQ,
            boost: 15,
          },
        },
      },
      // 3. All query terms present across key attributes (operator: AND)
      {
        multi_match: {
          query: rawQ,
          fields: [
            "name^10",
            "purpose^6",
            "category^4",
            "description^2",
          ],
          type: "cross_fields",
          operator: "and",
          boost: 10,
        },
      },
      // 4. Typo-tolerant fuzzy matching across fields (preserves "Surf Exel" -> Surf Excel)
      {
        multi_match: {
          query: rawQ,
          fields: [
            "name^4",
            "name.keyword^5",
            "purpose^3",
            "category^2",
            "description^1",
          ],
          type: "best_fields",
          operator: "or",
          fuzziness: "AUTO",
          prefix_length: 1,
          max_expansions: 50,
          boost: 2,
        },
      },
      // 5. Match on analyzed name field
      {
        match: {
          name: {
            query: rawQ,
            boost: 3,
            fuzziness: "AUTO",
          },
        },
      },
    ];

    // 6. Boost documents whose category or purpose matches search tokens (e.g. 'tea' in category/purpose)
    const tokens = rawQ
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ""))
      .filter((t) => t.length >= 3);

    for (const token of tokens) {
      should.push({
        wildcard: {
          category: {
            value: `*${token}*`,
            case_insensitive: true,
            boost: 15,
          },
        },
      });
      should.push({
        wildcard: {
          purpose: {
            value: `*${token}*`,
            case_insensitive: true,
            boost: 12,
          },
        },
      });
    }

    must.push({
      bool: {
        should,
        minimum_should_match: 1,
      },
    });
  }

  if (options.category) {
    filter.push({ term: { category: options.category.trim() } });
  }

  if (options.city) {
    filter.push({ term: { city: options.city.trim() } });
  }

  if (options.storeId) {
    filter.push({ term: { storeId: options.storeId.trim() } });
  }

  if (options.minPricePaise !== undefined || options.maxPricePaise !== undefined) {
    const range: Record<string, number> = {};
    if (options.minPricePaise !== undefined) range.gte = options.minPricePaise;
    if (options.maxPricePaise !== undefined) range.lte = options.maxPricePaise;
    filter.push({ range: { pricePaise: range } });
  }

  const query: Record<string, unknown> = {};
  if (must.length > 0 || filter.length > 0) {
    query.bool = {
      ...(must.length > 0 ? { must } : { must: [{ match_all: {} }] }),
      ...(filter.length > 0 ? { filter } : {}),
    };
  } else {
    query.match_all = {};
  }

  return query;
}

/**
 * Discovery Search Service
 * 
 * 1. Validates inputs.
 * 2. Executes OpenSearch query.
 * 3. Extracts candidate product and store IDs in relevance order.
 * 4. Hydrates candidates using the injected ProductFactsReader.
 * 5. Excludes missing and unavailable products.
 * 6. Caps results at maximum 24.
 */
export async function searchProducts(options: SearchOptions = {}): Promise<SearchResult> {
  validateSearchOptions(options);

  const client = options.client || getOpenSearchClient();
  const index = options.index || getOpenSearchConfig().index;
  const factsReader = options.factsReader ?? (process.env.SMARTTIJORI_DEMO_MODE === "true" ? new FixtureProductFactsReader() : undefined);
  if (!factsReader) {
    throw new DependencyUnavailableError("Authoritative commerce facts reader is not configured. Live search must not use fixtures.");
  }
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 24);

  const query = buildOpenSearchQuery(options);

  let searchRes: unknown;
  try {
    searchRes = await client.search({
      index,
      body: {
        query,
        size: limit * 2, // Fetch buffer to allow for availability filtering during hydration
      },
    });
  } catch (error: unknown) {
    const errObj = error as { message?: string; meta?: { statusCode?: number } };
    const statusCode = errObj.meta?.statusCode;
    if (statusCode === 404) {
      throw new DependencyUnavailableError(`OpenSearch index '${index}' does not exist.`);
    }
    const msg = errObj.message || String(error);
    throw new DependencyUnavailableError(`OpenSearch query failed: ${msg}`);
  }

  const resBody = (searchRes as { body?: { hits?: { hits?: Array<{ _source?: Record<string, unknown> }> } } })?.body;
  const hits = resBody?.hits?.hits || [];
  const candidateKeys: { storeId: string; productId: string }[] = [];

  for (const hit of hits) {
    const source = hit._source as Record<string, unknown> | undefined;
    if (source && typeof source.storeId === "string" && typeof source.productId === "string") {
      candidateKeys.push({
        storeId: source.storeId,
        productId: source.productId,
      });
    }
  }

  if (candidateKeys.length === 0) {
    return { items: [], total: 0 };
  }

  // Group candidate product IDs by storeId for batch coherent reading
  const storeToProducts = new Map<string, string[]>();
  for (const { storeId, productId } of candidateKeys) {
    const list = storeToProducts.get(storeId) || [];
    if (!list.includes(productId)) {
      list.push(productId);
    }
    storeToProducts.set(storeId, list);
  }

  // Hydrate via facts reader
  const factsMap = new Map<string, ProductOffer>();
  for (const [storeId, productIds] of storeToProducts.entries()) {
    try {
      const offers = await factsReader.readProductFacts(storeId, productIds);
      for (const offer of offers) {
        factsMap.set(`${offer.storeId}:${offer.productId}`, offer);
      }
    } catch (factsErr: unknown) {
      const msg = factsErr instanceof Error ? factsErr.message : String(factsErr);
      throw new DependencyUnavailableError(`Facts reader hydration failed: ${msg}`);
    }
  }

  // Assemble hydrated offers in the exact OpenSearch relevance order
  const hydratedOffers: ProductOffer[] = [];
  const seenKeys = new Set<string>();

  for (const { storeId, productId } of candidateKeys) {
    const key = `${storeId}:${productId}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const factOffer = factsMap.get(key);
    // 1. Exclude missing products
    if (!factOffer) continue;

    // 2. Exclude unavailable products unless explicitly requested
    if (!options.includeUnavailable && !factOffer.available) {
      continue;
    }

    hydratedOffers.push(factOffer);

    if (hydratedOffers.length >= limit) {
      break;
    }
  }

  return {
    items: hydratedOffers,
    total: hydratedOffers.length,
  };
}
