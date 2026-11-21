import type { Client } from "@opensearch-project/opensearch";
import type { ProductOffer } from "../contracts/catalog";
import type {
  ProjectionItemResult,
  ProjectionResult,
  ProjectionWriter,
} from "../contracts/discovery";
import { getOpenSearchClient, getOpenSearchConfig } from "./opensearch-client";

export function getDocumentId(storeId: string, productId: string): string {
  return `${storeId}:${productId}`;
}

export function validateProductOffer(offer: ProductOffer): string | null {
  if (!offer.productId || typeof offer.productId !== "string") {
    return "Missing or invalid productId";
  }
  if (!offer.storeId || typeof offer.storeId !== "string") {
    return "Missing or invalid storeId";
  }
  if (!offer.name || typeof offer.name !== "string") {
    return "Missing or invalid name";
  }
  if (typeof offer.pricePaise !== "number" || isNaN(offer.pricePaise) || offer.pricePaise < 0) {
    return "Missing or invalid pricePaise (must be non-negative integer)";
  }
  if (
    typeof offer.inventoryVersion !== "number" ||
    isNaN(offer.inventoryVersion) ||
    offer.inventoryVersion < 0
  ) {
    return "Missing or invalid inventoryVersion (must be non-negative integer)";
  }
  return null;
}

export interface WriteProjectionOptions {
  client?: Client;
  index?: string;
  refresh?: boolean | "wait_for";
}

/**
 * Production Projection Writer
 * 
 * - Uses stable document ID: storeId:productId.
 * - Replaces whole documents.
 * - Enforces monotonic inventoryVersion: equal and older versions cannot regress newer indexed docs.
 * - Returns applied, unchanged, or failure for every item.
 * - Classifies failures as permanent (schema/validation) or transient (network/timeout/5xx).
 * - Handles partial bulk failures individually.
 * - Never swallows errors.
 * - Does NOT acknowledge Kafka messages.
 */
export class OpenSearchProjectionWriter implements ProjectionWriter {
  private client?: Client;
  private indexName?: string;
  private refresh: boolean | "wait_for";

  constructor(options?: WriteProjectionOptions) {
    this.client = options?.client;
    this.indexName = options?.index;
    this.refresh = options?.refresh ?? false;
  }

  async writeProjection(offers: ProductOffer[]): Promise<ProjectionResult> {
    return writeProjection(offers, {
      client: this.client,
      index: this.indexName,
      refresh: this.refresh,
    });
  }
}

export async function writeProjection(
  offers: ProductOffer[],
  options?: WriteProjectionOptions
): Promise<ProjectionResult> {
  if (!offers || offers.length === 0) {
    return {
      appliedCount: 0,
      unchangedCount: 0,
      failureCount: 0,
      items: [],
    };
  }

  const client = options?.client || getOpenSearchClient();
  const index = options?.index || getOpenSearchConfig().index;
  const refresh = options?.refresh ?? false;

  const results: ProjectionItemResult[] = [];
  const validOffersToWrite: { offer: ProductOffer; docId: string }[] = [];

  // 1. Initial Validation & Document ID Assignment
  for (const offer of offers) {
    const docId = getDocumentId(offer?.storeId, offer?.productId);
    const validationError = validateProductOffer(offer);

    if (validationError) {
      results.push({
        documentId: docId,
        productId: offer?.productId || "unknown",
        storeId: offer?.storeId || "unknown",
        status: "failure",
        version: offer?.inventoryVersion,
        classification: "permanent",
        error: `Validation error: ${validationError}`,
      });
    } else {
      validOffersToWrite.push({ offer, docId });
    }
  }

  if (validOffersToWrite.length === 0) {
    return {
      appliedCount: 0,
      unchangedCount: 0,
      failureCount: results.length,
      items: results,
    };
  }

  // 2. Monotonic inventoryVersion check: fetch existing versions
  const docIds = validOffersToWrite.map((v) => v.docId);
  const existingVersionMap = new Map<string, number>();

  try {
    const mgetRes = await client.mget({
      index,
      body: {
        ids: docIds,
      },
    });

    const docs = mgetRes.body?.docs || [];
    for (const doc of docs) {
      if ("found" in doc && doc.found && doc._source) {
        const source = doc._source as Record<string, unknown>;
        const existingVer = source.inventoryVersion;
        if (typeof existingVer === "number") {
          existingVersionMap.set(doc._id, existingVer);
        }
      }
    }
  } catch (mgetError: unknown) {
    const errorObj = mgetError as { meta?: { statusCode?: number }; message?: string };
    // If index does not exist or transient network error
    if (errorObj.meta?.statusCode === 404) {
      // Index does not exist yet; all valid offers will attempt bulk write
    } else {
      const isTransient = isTransientError(mgetError);
      const errorMsg = errorObj.message || String(mgetError);
      // If we cannot check versions due to service error, mark remaining valid as failed
      for (const { offer, docId } of validOffersToWrite) {
        results.push({
          documentId: docId,
          productId: offer.productId,
          storeId: offer.storeId,
          status: "failure",
          version: offer.inventoryVersion,
          classification: isTransient ? "transient" : "permanent",
          error: `Failed version verification check: ${errorMsg}`,
        });
      }

      return {
        appliedCount: 0,
        unchangedCount: 0,
        failureCount: results.length,
        items: results,
      };
    }
  }

  // 3. Filter out equal or older versions
  const eligibleOffersForBulk: { offer: ProductOffer; docId: string }[] = [];

  for (const { offer, docId } of validOffersToWrite) {
    const existingVersion = existingVersionMap.get(docId);

    if (existingVersion !== undefined && offer.inventoryVersion <= existingVersion) {
      // Monotonic guard: equal or older version cannot regress indexed doc
      results.push({
        documentId: docId,
        productId: offer.productId,
        storeId: offer.storeId,
        status: "unchanged",
        version: offer.inventoryVersion,
        error: `Incoming version (${offer.inventoryVersion}) <= existing indexed version (${existingVersion})`,
      });
    } else {
      eligibleOffersForBulk.push({ offer, docId });
    }
  }

  if (eligibleOffersForBulk.length === 0) {
    const applied = results.filter((r) => r.status === "applied").length;
    const unchanged = results.filter((r) => r.status === "unchanged").length;
    const failures = results.filter((r) => r.status === "failure").length;
    return {
      appliedCount: applied,
      unchangedCount: unchanged,
      failureCount: failures,
      items: results,
    };
  }

  // 4. Construct Bulk Index Operations
  const bulkOperations: Record<string, unknown>[] = [];
  const now = new Date().toISOString();

  for (const { offer, docId } of eligibleOffersForBulk) {
    bulkOperations.push({
      index: {
        _index: index,
        _id: docId,
      },
    });

    bulkOperations.push({
      ...offer,
      indexedAt: now,
    });
  }

  // 5. Execute Bulk Write
  try {
    const bulkRes = await client.bulk({
      refresh,
      body: bulkOperations,
    });

    const items = bulkRes.body?.items || [];

    for (let i = 0; i < items.length; i++) {
      const itemAction = items[i].index || items[i].create || items[i].update;
      const target = eligibleOffersForBulk[i];

      if (!itemAction || !target) continue;

      if (itemAction.status >= 200 && itemAction.status < 300) {
        results.push({
          documentId: target.docId,
          productId: target.offer.productId,
          storeId: target.offer.storeId,
          status: "applied",
          version: target.offer.inventoryVersion,
        });
      } else {
        const statusCode = itemAction.status;
        const errObj = itemAction.error;
        const errMsg = typeof errObj === "string" ? errObj : errObj?.reason || `HTTP ${statusCode}`;
        const classification = isTransientStatusCode(statusCode) ? "transient" : "permanent";

        results.push({
          documentId: target.docId,
          productId: target.offer.productId,
          storeId: target.offer.storeId,
          status: "failure",
          version: target.offer.inventoryVersion,
          classification,
          error: errMsg,
        });
      }
    }
  } catch (bulkError: unknown) {
    const isTransient = isTransientError(bulkError);
    const errObj = bulkError as { message?: string };
    const errMsg = errObj.message || String(bulkError);
    for (const { offer, docId } of eligibleOffersForBulk) {
      results.push({
        documentId: docId,
        productId: offer.productId,
        storeId: offer.storeId,
        status: "failure",
        version: offer.inventoryVersion,
        classification: isTransient ? "transient" : "permanent",
        error: `Bulk write failure: ${errMsg}`,
      });
    }
  }

  const appliedCount = results.filter((r) => r.status === "applied").length;
  const unchangedCount = results.filter((r) => r.status === "unchanged").length;
  const failureCount = results.filter((r) => r.status === "failure").length;

  return {
    appliedCount,
    unchangedCount,
    failureCount,
    items: results,
  };
}

function isTransientStatusCode(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504 || status === 408;
}

function isTransientError(error: unknown): boolean {
  const errObj = error as { meta?: { statusCode?: number }; statusCode?: number; status?: number; message?: string };
  const code = errObj?.meta?.statusCode || errObj?.statusCode || errObj?.status;
  if (code && isTransientStatusCode(code)) return true;

  const msg = (errObj?.message || String(error) || "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("socket hang up") ||
    msg.includes("network")
  );
}
