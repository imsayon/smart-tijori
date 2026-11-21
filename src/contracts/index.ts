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
  sessionId: string;
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
  sessionId: string;
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
export interface OpsState {
  storeId: string;
  stock: Array<{
    productId: string;
    stockOnHand: number;
    held: number;
    available: number;
    inventoryVersion: number;
  }>;
  checkedAt: string;
}

// === Errors ===
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'STOCK_UNAVAILABLE'
  | 'HOLD_EXPIRED'
  | 'HOLD_NOT_ACTIVE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'STOCK_LOCKED_ONLINE'
  | 'BARCODE_UNKNOWN';

export interface ApiError {
  code: ErrorCode;
  message: string;
}

// === POS Barcode Sale Gate Contracts (Coordinated with Sayon) ===
export interface PosSaleInput {
  storeId: string;
  barcode: string;
  quantity: number;
  operatorId: string;   // Resolved server-side from operator session
  operationKey: string; // Idempotency key
}

export type PosSaleOutcome =
  | {
      ok: true;
      saleId: string;
      storeId: string;
      productId: string;
      productName: string;
      quantity: number;
      unitPricePaise: number;
      totalPaise: number;
      allocatedAt: string; // ISO 8601
      inventoryVersion: number;
      source: 'POSTGRESQL_TRANSACTION' | 'FIXTURE_SIMULATED';
    }
  | {
      ok: false;
      code: 'STOCK_LOCKED_ONLINE' | 'STOCK_UNAVAILABLE' | 'BARCODE_UNKNOWN' | 'IDEMPOTENCY_CONFLICT';
      message: string;
      details?: {
        productId?: string;
        availableStock?: number;
        activeHoldExpiresAt?: string;
      };
      source: 'POSTGRESQL_TRANSACTION' | 'FIXTURE_SIMULATED';
    };

// === Stock Interest ===
export interface StockInterest {
  id: string;
  sessionId: string;
  storeId: string;
  productId: string;
  createdAt: string;
}
