import { v4 as uuidv4 } from 'uuid';
import type {
  Cart,
  CartLine,
  Hold,
  HoldStatus,
  Order,
  OrderLine,
  ProductOffer,
  StockInterest,
  Store,
} from '@/contracts';
import type { CommerceCommands, CreateHoldResult } from './commerce-commands';
import { STORES, searchOffers } from '@/dev/shopper-fixtures';
import { HttpError } from '../errors/http-errors';

interface IdempotencyEntry<T> {
  actor: string;
  operation: string;
  key: string;
  requestFingerprint: string;
  response: T;
  createdAt: number;
}

export const HOLD_DURATION_SECONDS = 300; // fixed five-minute non-renewing hold

export class FixtureCommerceAdapter implements CommerceCommands {

  authorizePosSale: CommerceCommands['authorizePosSale'] = async () => ({
    ok: false,
    error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'POS authorization requires the PostgreSQL adapter.' },
  });

  private carts = new Map<string, Cart>(); // sessionId -> Cart
  private holds = new Map<string, Hold>(); // holdId -> Hold
  private orders = new Map<string, Order>(); // orderId -> Order
  private interests: StockInterest[] = [];
  private idempotencyStore = new Map<string, IdempotencyEntry<unknown>>(); // key: actor:operation:key

  // Simulated inventory availability overrides (e.g. for demonstrating LastOne / conflict)
  private inventoryOverrides = new Map<string, number>(); // storeId:productId -> available

  constructor() {
    this.resetState();
  }

  resetState(): void {
    this.carts.clear();
    this.holds.clear();
    this.orders.clear();
    this.interests.length = 0;
    this.idempotencyStore.clear();
    this.inventoryOverrides.clear();
  }

  setStockOverride(storeId: string, productId: string, available: number): void {
    this.inventoryOverrides.set(`${storeId}:${productId}`, available);
  }

  expireHold(holdId: string): void {
    const hold = this.holds.get(holdId);
    if (hold) {
      this.holds.set(holdId, {
        ...hold,
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
    }
  }

  private getEffectiveAvailable(offer: ProductOffer): number {
    const key = `${offer.storeId}:${offer.productId}`;
    if (this.inventoryOverrides.has(key)) {
      return this.inventoryOverrides.get(key)!;
    }
    return offer.available;
  }

  // Idempotency resolution helper
  private resolveIdempotency<T>(
    actor: string,
    operation: string,
    key: string,
    requestFingerprint: string
  ): { cached: boolean; response?: T } {
    const compositeKey = `${actor}:${operation}:${key}`;
    const existing = this.idempotencyStore.get(compositeKey);

    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        throw new HttpError(
          'IDEMPOTENCY_CONFLICT',
          'Operation key was already used with different request parameters',
          409
        );
      }
      return { cached: true, response: existing.response as T };
    }

    return { cached: false };
  }

  private saveIdempotency<T>(
    actor: string,
    operation: string,
    key: string,
    requestFingerprint: string,
    response: T
  ): void {
    const compositeKey = `${actor}:${operation}:${key}`;
    this.idempotencyStore.set(compositeKey, {
      actor,
      operation,
      key,
      requestFingerprint,
      response,
      createdAt: Date.now(),
    });
  }

  // ---------------------------------------------------------------------------
  // Stores & Products
  // ---------------------------------------------------------------------------
  async listStores(): Promise<Store[]> {
    return STORES;
  }

  async getProductOffers(
    storeId: string,
    params?: {
      q?: string;
      category?: string;
      minPricePaise?: number;
      maxPricePaise?: number;
      city?: string;
    }
  ): Promise<ProductOffer[]> {
    const offers = searchOffers(storeId, params);
    return offers.map((o) => ({
      ...o,
      available: this.getEffectiveAvailable(o),
      checkedAt: new Date().toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Cart
  // ---------------------------------------------------------------------------
  async getCart(sessionId: string): Promise<Cart> {
    const existing = this.carts.get(sessionId);
    if (existing) {
      return existing;
    }

    const defaultCart: Cart = {
      id: `cart-${uuidv4().slice(0, 8)}`,
      sessionId,
      storeId: 'blr-01', // Default to Bengaluru
      lines: [],
      totalPaise: 0,
    };
    this.carts.set(sessionId, defaultCart);
    return defaultCart;
  }

  async updateCart(
    sessionId: string,
    storeId: string,
    lines: Array<{ productId: string; quantity: number }>
  ): Promise<Cart> {
    // Editing cart automatically releases any active hold owned by this session (Master Plan rule 3)
    for (const [holdId, hold] of this.holds.entries()) {
      if (hold.sessionId === sessionId && hold.status === 'ACTIVE') {
        this.holds.set(holdId, { ...hold, status: 'RELEASED' });
      }
    }

    // Filter out zero-quantity lines
    const validLines = lines.filter((l) => l.quantity > 0);

    // Look up offers for store to calculate server-authoritative prices
    const offers = searchOffers(storeId);
    const offerMap = new Map<string, ProductOffer>(offers.map((o) => [o.productId, o]));

    const cartLines: CartLine[] = [];
    let totalPaise = 0;

    for (const line of validLines) {
      const offer = offerMap.get(line.productId);
      if (!offer) {
        throw new HttpError(
          'VALIDATION_ERROR',
          `Product ${line.productId} not found in store ${storeId}`,
          400
        );
      }

      const unitPricePaise = offer.pricePaise;
      totalPaise += unitPricePaise * line.quantity;
      cartLines.push({
        productId: line.productId,
        quantity: line.quantity,
        name: offer.name,
        unitPricePaise,
      });
    }

    const existingCart = this.carts.get(sessionId);
    const updatedCart: Cart = {
      id: existingCart?.id ?? `cart-${uuidv4().slice(0, 8)}`,
      sessionId,
      storeId,
      lines: cartLines,
      totalPaise,
    };

    this.carts.set(sessionId, updatedCart);
    return updatedCart;
  }

  // ---------------------------------------------------------------------------
  // Hold / Reservation
  // ---------------------------------------------------------------------------
  async createHold(
    sessionId: string,
    cartId: string,
    operationKey: string
  ): Promise<CreateHoldResult> {
    const cart = this.carts.get(sessionId);
    if (!cart || cart.id !== cartId) {
      throw new HttpError('NOT_FOUND', 'Cart not found or not owned by session', 404);
    }

    if (cart.lines.length === 0) {
      throw new HttpError('VALIDATION_ERROR', 'Cannot checkout an empty cart', 400);
    }

    const linesFingerprint = cart.lines.map((l) => `${l.productId}:${l.quantity}`).join(',');
    const fingerprint = `${cartId}:${linesFingerprint}:${cart.totalPaise}`;

    const idempotency = this.resolveIdempotency<CreateHoldResult>(
      sessionId,
      'createHold',
      operationKey,
      fingerprint
    );
    if (idempotency.cached && idempotency.response) {
      return idempotency.response;
    }

    // Release any existing active hold for this session (One active hold per session)
    for (const [id, h] of this.holds.entries()) {
      if (h.sessionId === sessionId && h.status === 'ACTIVE') {
        this.holds.set(id, { ...h, status: 'RELEASED' });
      }
    }

    // Check inventory availability (all or nothing)
    const unavailableProducts: string[] = [];
    for (const line of cart.lines) {
      const offers = searchOffers(cart.storeId);
      const offer = offers.find((o) => o.productId === line.productId);
      const available = offer ? this.getEffectiveAvailable(offer) : 0;
      if (available < line.quantity) {
        unavailableProducts.push(line.productId);
      }
    }

    if (unavailableProducts.length > 0) {
      const result: CreateHoldResult = {
        ok: false,
        code: 'STOCK_UNAVAILABLE',
        unavailableProducts,
      };
      this.saveIdempotency(sessionId, 'createHold', operationKey, fingerprint, result);
      return result;
    }

    // Create a fixed five-minute active hold
    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_DURATION_SECONDS * 1000);

    const hold: Hold = {
      id: `hold-${uuidv4().slice(0, 8)}`,
      cartId: cart.id,
      sessionId,
      storeId: cart.storeId,
      status: 'ACTIVE',
      expiresAt: expiresAt.toISOString(),
      serverNow: now.toISOString(),
      lines: cart.lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        name: l.name,
        unitPricePaise: l.unitPricePaise,
      })),
      totalPaise: cart.totalPaise,
    };

    this.holds.set(hold.id, hold);
    const result: CreateHoldResult = { ok: true, hold };
    this.saveIdempotency(sessionId, 'createHold', operationKey, fingerprint, result);
    return result;
  }

  async getHold(sessionId: string, holdId: string): Promise<Hold | null> {
    const hold = this.holds.get(holdId);
    if (!hold || hold.sessionId !== sessionId) {
      return null;
    }

    // Dynamic server-time evaluation of expiry
    const now = new Date();
    const isPastDeadline = new Date(hold.expiresAt).getTime() <= now.getTime();
    let currentStatus: HoldStatus = hold.status;

    if (currentStatus === 'ACTIVE' && isPastDeadline) {
      currentStatus = 'EXPIRED';
      this.holds.set(holdId, { ...hold, status: 'EXPIRED' });
    }

    return {
      ...hold,
      status: currentStatus,
      serverNow: now.toISOString(),
    };
  }

  async releaseHold(sessionId: string, holdId: string): Promise<Hold | null> {
    const hold = this.holds.get(holdId);
    if (!hold || hold.sessionId !== sessionId) {
      return null;
    }

    if (hold.status === 'ACTIVE') {
      const updated: Hold = {
        ...hold,
        status: 'RELEASED',
        serverNow: new Date().toISOString(),
      };
      this.holds.set(holdId, updated);
      return updated;
    }

    return {
      ...hold,
      serverNow: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Orders
  // ---------------------------------------------------------------------------
  async confirmOrder(
    sessionId: string,
    reservationId: string,
    operationKey: string
  ): Promise<Order> {
    const fingerprint = `${reservationId}`;
    const idempotency = this.resolveIdempotency<Order>(
      sessionId,
      'confirmOrder',
      operationKey,
      fingerprint
    );
    if (idempotency.cached && idempotency.response) {
      return idempotency.response;
    }

    const hold = this.holds.get(reservationId);
    if (!hold || hold.sessionId !== sessionId) {
      throw new HttpError('NOT_FOUND', 'Reservation not found or not owned by session', 404);
    }

    const now = new Date();
    if (hold.status === 'CONSUMED') {
      // Find matching confirmed order
      for (const order of this.orders.values()) {
        if (order.reservationId === reservationId) {
          this.saveIdempotency(sessionId, 'confirmOrder', operationKey, fingerprint, order);
          return order;
        }
      }
      throw new HttpError('HOLD_NOT_ACTIVE', 'Reservation has already been consumed', 409);
    }

    if (hold.status === 'EXPIRED' || new Date(hold.expiresAt).getTime() <= now.getTime()) {
      this.holds.set(reservationId, { ...hold, status: 'EXPIRED' });
      throw new HttpError(
        'HOLD_EXPIRED',
        'Reservation has expired. Please revalidate cart and reserve again.',
        409
      );
    }

    if (hold.status !== 'ACTIVE') {
      throw new HttpError(
        'HOLD_NOT_ACTIVE',
        `Reservation is in ${hold.status} state and cannot be confirmed`,
        409
      );
    }

    // Atomic consumption of reservation
    this.holds.set(reservationId, { ...hold, status: 'CONSUMED' });

    // Debit book stock in simulated inventory
    for (const line of hold.lines) {
      const key = `${hold.storeId}:${line.productId}`;
      const current = this.inventoryOverrides.has(key)
        ? this.inventoryOverrides.get(key)!
        : 50;
      this.inventoryOverrides.set(key, Math.max(0, current - line.quantity));
    }

    // Create confirmed order
    const orderLines: OrderLine[] = hold.lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      name: l.name,
      unitPricePaise: l.unitPricePaise,
    }));

    const order: Order = {
      id: `order-${uuidv4().slice(0, 8)}`,
      reservationId,
      storeId: hold.storeId,
      status: 'CONFIRMED',
      createdAt: now.toISOString(),
      lines: orderLines,
      totalPaise: hold.totalPaise,
      paymentMode: 'SIMULATED',
    };

    this.orders.set(order.id, order);

    // Terminal cart transition: generate a fresh cart for subsequent shopper journeys
    this.carts.set(sessionId, {
      id: `cart-${uuidv4().slice(0, 8)}`,
      sessionId,
      storeId: hold.storeId,
      lines: [],
      totalPaise: 0,
    });

    this.saveIdempotency(sessionId, 'confirmOrder', operationKey, fingerprint, order);
    return order;
  }

  async getOrder(sessionId: string, orderId: string): Promise<Order | null> {
    const order = this.orders.get(orderId);
    if (!order) {
      return null;
    }

    // Verify ownership via associated reservation
    const hold = this.holds.get(order.reservationId);
    if (!hold || hold.sessionId !== sessionId) {
      return null;
    }

    return order;
  }

  // ---------------------------------------------------------------------------
  // Stock Interest
  // ---------------------------------------------------------------------------
  async saveInterest(
    sessionId: string,
    storeId: string,
    productId: string
  ): Promise<StockInterest> {
    const existing = this.interests.find(
      (i) => i.sessionId === sessionId && i.storeId === storeId && i.productId === productId
    );
    if (existing) {
      return existing;
    }

    const interest: StockInterest = {
      id: `int-${uuidv4().slice(0, 8)}`,
      sessionId,
      storeId,
      productId,
      createdAt: new Date().toISOString(),
    };
    this.interests.push(interest);
    return interest;
  }
}
