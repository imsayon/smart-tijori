export const MAX_LINES = 24;
export const MAX_QUANTITY = 99;
export const MAX_RESTOCK = 1_000;

export interface Store {
  id: string;
  name: string;
  city: string;
}

export interface ProductOffer {
  productId: string;
  storeId: string;
  city: string;
  name: string;
  category: string;
  purpose: string;
  pricePaise: number;
  imageUrl: string | null;
  pack: { quantity: number; unit: "g" | "ml" | "count" };
  attributes: Record<string, string | number | boolean>;
  available: number;
  inventoryVersion: number;
  checkedAt: string;
}

export interface LineInput {
  productId: string;
  quantity: number;
}

export interface Line extends LineInput {
  name: string;
  unitPricePaise: number;
}

export interface Cart {
  id: string;
  storeId: string | null;
  lines: Line[];
  totalPaise: number;
}

export interface Hold {
  id: string;
  cartId: string;
  storeId: string;
  status: "ACTIVE" | "RELEASED" | "EXPIRED" | "CONSUMED";
  expiresAt: string;
  serverNow: string;
  lines: Line[];
  totalPaise: number;
}

export interface Order {
  id: string;
  reservationId: string;
  storeId: string;
  status: "CONFIRMED";
  createdAt: string;
  lines: Line[];
  totalPaise: number;
  paymentMode: "SIMULATED" | "RAZORPAY";
}

export interface PosSaleInput {
  storeId: string;
  barcode: string;
  quantity: number;
  key: string;
}

export interface PosSale {
  saleId: string;
  storeId: string;
  status: "CONFIRMED";
  source: "postgresql";
  soldAt: string;
  lines: (Line & { inventoryVersion: number })[];
  totalPaise: number;
}

export interface StockMovement {
  productId: string;
  kind: "ORDER" | "POS" | "RESTOCK";
  referenceId: string;
  quantityDelta: number;
  occurredAt: string;
}

export interface OpsFacts {
  storeId: string;
  checkedAt: string;
  stock: { productId: string; stockOnHand: number; held: number; available: number; inventoryVersion: number }[];
  recentMovements: StockMovement[];
}

// These identities come from verified server-side sessions. Never derive them from request bodies.
export type Actor =
  | { kind: "shopper"; id: string }
  | { kind: "operator"; id: string; storeIds: readonly string[] };

export type CommerceErrorCode =
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STOCK_UNAVAILABLE"
  | "STOCK_LOCKED_ONLINE"
  | "HOLD_EXPIRED"
  | "HOLD_NOT_ACTIVE"
  | "ORDER_ALREADY_PLACED"
  | "IDEMPOTENCY_CONFLICT"
  | "DEPENDENCY_UNAVAILABLE";

export type Outcome<T> = { ok: true; value: T }
  | { ok: false; error: { code: CommerceErrorCode; message: string; productIds?: string[] } };

export type PosSaleOutcome = Outcome<PosSale>;

export interface CommerceCommands {
  listStores(): Promise<Outcome<Store[]>>;
  getCart(actor: Actor): Promise<Outcome<Cart>>;
  putCart(actor: Actor, input: { storeId: string; lines: readonly LineInput[] }): Promise<Outcome<Cart>>;
  reserve(actor: Actor, input: { cartId: string; key: string }): Promise<Outcome<Hold>>;
  getHold(actor: Actor, id: string): Promise<Outcome<Hold>>;
  releaseHold(actor: Actor, id: string): Promise<Outcome<Hold>>;
  placeOrder(actor: Actor, input: { reservationId: string; key: string }): Promise<Outcome<Order>>;
  getOrder(actor: Actor, id: string): Promise<Outcome<Order>>;
  saveInterest(actor: Actor, input: { storeId: string; productId: string }): Promise<Outcome<{ saved: true }>>;
  authorizePosSale(actor: Actor, input: PosSaleInput): Promise<PosSaleOutcome>;
  recordPosSale(actor: Actor, input: { storeId: string; lines: readonly LineInput[]; key: string }): Promise<PosSaleOutcome>;
  restock(actor: Actor, input: { storeId: string; productId: string; quantity: number; key: string }): Promise<Outcome<ProductOffer>>;
}

export interface CommerceFacts {
  readProductFacts(storeId: string, productIds: readonly string[]): Promise<ProductOffer[]>;
  readOpsFacts(storeId: string): Promise<OpsFacts>;
}
