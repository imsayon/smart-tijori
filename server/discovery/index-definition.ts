import type { Client } from "@opensearch-project/opensearch";
import indexConfig from "../../infra/opensearch-index.json";
import { getOpenSearchConfig } from "./opensearch-client";

export const OPENSEARCH_PRODUCT_INDEX_CONFIG = indexConfig;

export interface SetupIndexResult {
  index: string;
  created: boolean;
  alreadyExisted: boolean;
  acknowledged: boolean;
}

/**
 * Safely creates or verifies the product index with explicit mappings.
 * Does not overwrite existing indices or drop data.
 */
export async function setupProductIndex(
  client: Client,
  customIndexName?: string
): Promise<SetupIndexResult> {
  const indexName = customIndexName || getOpenSearchConfig().index;

  const existsRes = await client.indices.exists({ index: indexName });
  const alreadyExisted = existsRes.body === true;

  if (alreadyExisted) {
    return {
      index: indexName,
      created: false,
      alreadyExisted: true,
      acknowledged: true,
    };
  }

  const createRes = await client.indices.create({
    index: indexName,
    body: OPENSEARCH_PRODUCT_INDEX_CONFIG as unknown as Parameters<typeof client.indices.create>[0]["body"],
  });

  return {
    index: indexName,
    created: true,
    alreadyExisted: false,
    acknowledged: createRes.body?.acknowledged === true,
  };
}

/**
 * Deletes the index if explicitly needed for controlled test cleanups.
 */
export async function deleteProductIndex(
  client: Client,
  customIndexName?: string
): Promise<boolean> {
  const indexName = customIndexName || getOpenSearchConfig().index;
  const exists = await client.indices.exists({ index: indexName });
  if (!exists.body) return false;

  const res = await client.indices.delete({ index: indexName });
  return res.body?.acknowledged === true;
}
