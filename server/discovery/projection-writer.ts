import type { Client } from "@opensearch-project/opensearch";
import type { ProductOffer } from "../contracts/catalog";
import type {
  ProjectionItemResult,
  ProjectionResult,
  ProjectionWriter,
} from "../contracts/discovery";
import { getOpenSearchClient, getOpenSearchConfig } from "./opensearch-client.ts";

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
  if (!Number.isSafeInteger(offer.pricePaise) || offer.pricePaise < 0) {
    return "Missing or invalid pricePaise (must be non-negative integer)";
  }
  if (
    !Number.isSafeInteger(offer.inventoryVersion) ||
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

  // External versioning is enforced atomically *by OpenSearch during each write*.
  // A preceding mget cannot guard against concurrent/out-of-order bulk writes:
  // another writer could index a newer version between the read and the write.
  // Shift nonnegative inventoryVersion by one because external versions must be > 0.
  const bulkOperations: Record<string, unknown>[] = [];
  const now = new Date().toISOString();

  for (const { offer, docId } of validOffersToWrite) {
    bulkOperations.push({
      index: {
        _index: index,
        _id: docId,
        version: offer.inventoryVersion + 1,
        version_type: "external",
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

    for (let i = 0; i < validOffersToWrite.length; i++) {
      const item = items[i];
      const itemAction = item?.index || item?.create || item?.update;
      const target = validOffersToWrite[i];
      if (!itemAction) {
        results.push({ documentId: target.docId, productId: target.offer.productId, storeId: target.offer.storeId, status: "failure", version: target.offer.inventoryVersion, classification: "transient", error: "OpenSearch returned no bulk item outcome" });
        continue;
      }

      if (itemAction.status >= 200 && itemAction.status < 300) {
        results.push({
          documentId: target.docId,
          productId: target.offer.productId,
          storeId: target.offer.storeId,
          status: "applied",
          version: target.offer.inventoryVersion,
        });
      } else if (itemAction.status === 409) {
        // OpenSearch rejected an equal/older external version atomically.
        results.push({ documentId: target.docId, productId: target.offer.productId, storeId: target.offer.storeId, status: "unchanged", version: target.offer.inventoryVersion });
      } else {
        const statusCode = itemAction.status;
        const errObj = itemAction.error;
        const errMsg = typeof errObj === "string" ? errObj : errObj?.reason || `HTTP ${statusCode}`;
        const classification = statusCode === 400 ? "permanent" : "transient";

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
    // A failed request gives no document-level evidence for quarantine.
    const errObj = bulkError as { message?: string };
    const errMsg = errObj.message || String(bulkError);
    for (const { offer, docId } of validOffersToWrite) {
      results.push({
        documentId: docId,
        productId: offer.productId,
        storeId: offer.storeId,
        status: "failure",
        version: offer.inventoryVersion,
        classification: "transient",
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
