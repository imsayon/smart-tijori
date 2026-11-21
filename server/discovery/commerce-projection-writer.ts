import type { Client } from "@opensearch-project/opensearch";
import type { WriteProjection } from "../contracts/events.ts";
import { toDiscoveryOffer } from "./postgres-product-facts-reader.ts";
import { writeProjection } from "./projection-writer.ts";

export function createCommerceProjectionWriter(client: Client, index: string): WriteProjection {
  return async (offers, signal) => {
    signal?.throwIfAborted();
    const { items } = await writeProjection(offers.map(toDiscoveryOffer), { client, index });
    return items.map(({ documentId, status, classification }) => status === "failure"
      ? { documentId, status: "failed", retryable: classification === "transient" }
      : { documentId, status });
  };
}
