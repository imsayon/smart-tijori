// === Store ===
export interface Store {
  id: string;        // 'blr-01', 'blr-02', 'mys-01', etc.
  name: string;
  city: 'Bengaluru' | 'Mysuru';
  area?: string;     // e.g. 'Koramangala', 'Indiranagar', 'Jayanagar', 'Whitefield', etc.
  address?: string;  // neighborhood street address
}

// === Product ===
export interface PackInfo {
  quantity: number;  // e.g. 1000
  unit: 'g' | 'ml' | 'count';
}

export interface ProductOffer {
  productId: string;
  storeId: string;
  city: string;
  name: string;
  category: 'pantry' | 'household' | 'essentials';
  purpose: string;
  pricePaise: number;
  imageUrl: string;
  pack: PackInfo;
  attributes: Record<string, string>;
  available: number;
  inventoryVersion: number;
  checkedAt: string; // ISO 8601
}

// === Cart ===
export interface CartLine {
  productId: string;
  quantity: number;
  name: string;
  unitPricePaise: number;
}

export interface Cart {
  id: string;
  sessionId?: string;
  storeId: string;
  lines: CartLine[];
  totalPaise: number;
}

// === Hold/Reservation ===
export type HoldStatus = 'ACTIVE' | 'CONSUMED' | 'RELEASED' | 'EXPIRED';

export interface HoldLine {
  productId: string;
  quantity: number;
  name: string;
  unitPricePaise: number;
}

export interface Hold {
  id: string;
  cartId: string;
  sessionId?: string;
  storeId: string;
  status: HoldStatus;
  expiresAt: string;
  serverNow: string;
  lines: HoldLine[];
  totalPaise: number;
}

// === Order ===
export interface OrderLine {
  productId: string;
  quantity: number;
  name: string;
  unitPricePaise: number;
}

export interface Order {
  id: string;
  reservationId: string;
  storeId: string;
  status: 'CONFIRMED';
  createdAt: string;
  lines: OrderLine[];
  totalPaise: number;
  paymentMode: 'SIMULATED';
}

// === Recovery ===
export interface RecoveryConstraints {
  purpose: string;
  maxPricePaise?: number;
  minPack?: PackInfo;
  requiredAttributes?: Record<string, string>;
  preferences?: string[];
}

export interface RecoveryCandidate {
  offer: ProductOffer;
  reasons: string[];
}

export interface RecoveryResult {
  mode: 'ai' | 'rules';
  constraints: RecoveryConstraints;
  candidates: RecoveryCandidate[];
  checkedAt: string;
}

// === Operations (read-only for Srujan) ===
export interface OpsStockItem {
  productId: string;
  stockOnHand: number;
  held: number;
  available: number;
  inventoryVersion: number;
}

export interface StockMovement {
  productId: string;
  kind: 'ORDER' | 'POS' | 'RESTOCK';
  referenceId: string;
  quantityDelta: number;
  occurredAt: string;
}

export interface OpsFacts {
  storeId: string;
  checkedAt: string;
  stock: OpsStockItem[];
  recentMovements: StockMovement[];
}

export type OpsState = OpsFacts;

// === Pipeline Diagnostics (read-only for Srujan) ===
export interface RecentPipelineEvent {
  eventId: string;
  type: 'inventory.changed' | 'order.placed';
  occurredAt: string;
  publishedAt: string | null;
}

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
  recentEvents: RecentPipelineEvent[];
}

// === Errors ===
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'STOCK_LOCKED_ONLINE'
  | 'ORDER_ALREADY_PLACED'
  | 'STOCK_UNAVAILABLE'
  | 'HOLD_EXPIRED'
  | 'HOLD_NOT_ACTIVE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DEPENDENCY_UNAVAILABLE';

export interface ApiError {
  code: ErrorCode;
  message: string;
}

// === Stock Interest ===
export interface StockInterest {
  id: string;
  sessionId: string;
  storeId: string;
  productId: string;
  createdAt: string;
}
