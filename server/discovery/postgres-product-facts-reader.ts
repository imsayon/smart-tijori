import "server-only";
import { createCommerceFacts } from "../commerce/facts.ts";
import type { ProductOffer } from "../contracts/catalog";
import type { CommerceFacts, ProductOffer as CommerceOffer } from "../contracts/commerce";
import type { ProductFactsReader } from "../contracts/facts";
import { createDatabase } from "../db/database.ts";
import { createPostgresPool } from "../db/pool.ts";

export function toDiscoveryOffer(offer: CommerceOffer): ProductOffer {
  const { attributes, available, imageUrl, ...facts } = offer;
  return { ...facts, knownAttributes: attributes, available: available > 0, availableStock: available, imageUrl: imageUrl ?? "" };
}

export function createPostgresProductFactsReader(facts: Pick<CommerceFacts, "readProductFacts">): ProductFactsReader {
  return {
    async readProductFacts(storeId, productIds) {
      if (productIds.length === 0) return [];
      const offers = await facts.readProductFacts(storeId, productIds);
      return offers.map(toDiscoveryOffer);
    },
  };
}

let reader: ProductFactsReader | undefined;

export function getPostgresProductFactsReader(): ProductFactsReader {
  if (!reader) {
    const db = createDatabase(createPostgresPool(), process.env.ST_DB_SCHEMA ?? "");
    reader = createPostgresProductFactsReader(createCommerceFacts(db));
  }
  return reader;
}
