import type { ProductOffer } from "./catalog";

export interface DiscoveryQuery {
  q?: string;
  category?: string;
  minPricePaise?: number;
  maxPricePaise?: number;
  city?: string;
  storeId?: string;
  limit?: number;
}

export type ProjectionItemStatus = "applied" | "unchanged" | "failure";
export type FailureClassification = "permanent" | "transient";

export interface ProjectionItemResult {
  documentId: string;
  productId: string;
  storeId: string;
  status: ProjectionItemStatus;
  version?: number;
  classification?: FailureClassification;
  error?: string;
}

export interface ProjectionResult {
  appliedCount: number;
  unchangedCount: number;
  failureCount: number;
  items: ProjectionItemResult[];
}

export type ProjectionInput = ProductOffer[];

export interface ProjectionWriter {
  writeProjection(offers: ProductOffer[]): Promise<ProjectionResult>;
}

