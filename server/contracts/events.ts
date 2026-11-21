import type { ProductOffer } from "./commerce.ts";

export type CommerceEvent = {
  eventId: string;
  schemaVersion: 1;
  occurredAt: string;
} & (
  | { type: "inventory.changed"; payload: { storeId: string; productId: string; inventoryVersion: number } }
  | { type: "order.placed"; payload: { storeId: string; orderId: string; productIds: string[] } }
);

// Exactly one result per input offer, correlated by storeId:productId.
// Equal or newer indexed versions are unchanged. A writer resolves after all its work settles.
export type ProjectionResult = { documentId: string } & (
  | { status: "applied" | "unchanged" }
  | { status: "failed"; retryable: boolean }
);

export type WriteProjection = (offers: readonly ProductOffer[], signal?: AbortSignal) => Promise<readonly ProjectionResult[]>;

export interface PipelineFacts {
  storeId: string;
  checkedAt: string;
  pendingCount: number;
  oldestPendingAt: string | null;
  lastBrokerAckAt: string | null;
  lastProjectionAcceptedAt: string | null;
  lastError: { code: string; at: string } | null;
  projectionRetryCount: number;
  quarantineCount: number;
  unattributedQuarantineCount: number;
  recentEvents: { eventId: string; type: CommerceEvent["type"]; occurredAt: string; publishedAt: string | null }[];
}

export type ReadPipelineFacts = (storeId: string) => Promise<PipelineFacts>;
