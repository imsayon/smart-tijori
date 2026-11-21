import type { ProductOffer } from "./catalog";

export interface ProductFactsReader {
  /**
   * Batch coherent current-facts reader.
   * Missing or unknown products are omitted from the returned array.
   */
  readProductFacts(storeId: string, productIds: string[]): Promise<ProductOffer[]>;
}

