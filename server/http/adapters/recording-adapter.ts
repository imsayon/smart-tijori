import type { Cart, Hold, Order, StockInterest, ProductOffer, Store } from '@/contracts';
import type { CommerceCommands, CreateHoldResult } from './commerce-commands';

/** A single recorded call to a CommerceCommands method. */
export interface RecordedCall {
  method: keyof CommerceCommands;
  args: unknown[];
  timestamp: string;
}

/**
 * RecordingAdapter wraps a CommerceCommands implementation and records every
 * call for later assertions in tests. When no delegate is provided it returns
 * controlled fixture data that you configure via `setFixture`.
 */
export class RecordingAdapter implements CommerceCommands {
  readonly calls: RecordedCall[] = [];

  private fixtures: Partial<Record<keyof CommerceCommands, unknown>> = {};

  constructor(private readonly delegate?: CommerceCommands) {}

  // ---------------------------------------------------------------------------
  // Fixture helpers
  // ---------------------------------------------------------------------------

  /** Pre-configure the return value for a given method. */
  setFixture<K extends keyof CommerceCommands>(
    method: K,
    value: Awaited<ReturnType<CommerceCommands[K]>>,
  ): void {
    this.fixtures[method] = value;
  }

  /** Clear all recorded calls and fixtures. */
  reset(): void {
    this.calls.length = 0;
    this.fixtures = {};
  }

  /** Return calls filtered by method name. */
  callsFor<K extends keyof CommerceCommands>(method: K): RecordedCall[] {
    return this.calls.filter((c) => c.method === method);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private record(method: keyof CommerceCommands, args: unknown[]): void {
    this.calls.push({ method, args, timestamp: new Date().toISOString() });
  }

  private fixture<K extends keyof CommerceCommands>(
    method: K,
  ): Awaited<ReturnType<CommerceCommands[K]>> | undefined {
    return this.fixtures[method] as
      | Awaited<ReturnType<CommerceCommands[K]>>
      | undefined;
  }

  // ---------------------------------------------------------------------------
  // CommerceCommands implementation
  // ---------------------------------------------------------------------------

  async listStores(): Promise<Store[]> {
    this.record('listStores', []);
    if (this.delegate) return this.delegate.listStores();
    return (this.fixture('listStores') as Store[] | undefined) ?? [];
  }

  async getCart(sessionId: string): Promise<Cart> {
    this.record('getCart', [sessionId]);
    if (this.delegate) return this.delegate.getCart(sessionId);
    return (
      (this.fixture('getCart') as Cart | undefined) ?? {
        id: 'cart-stub',
        sessionId,
        storeId: '',
        lines: [],
        totalPaise: 0,
      }
    );
  }

  async updateCart(
    sessionId: string,
    storeId: string,
    lines: Array<{ productId: string; quantity: number }>,
  ): Promise<Cart> {
    this.record('updateCart', [sessionId, storeId, lines]);
    if (this.delegate)
      return this.delegate.updateCart(sessionId, storeId, lines);
    return (
      (this.fixture('updateCart') as Cart | undefined) ?? {
        id: 'cart-stub',
        sessionId,
        storeId,
        lines: [],
        totalPaise: 0,
      }
    );
  }

  async createHold(
    sessionId: string,
    cartId: string,
    operationKey: string,
  ): Promise<CreateHoldResult> {
    this.record('createHold', [sessionId, cartId, operationKey]);
    if (this.delegate)
      return this.delegate.createHold(sessionId, cartId, operationKey);
    return (
      (this.fixture('createHold') as CreateHoldResult | undefined) ?? {
        ok: true,
        hold: {
          id: 'hold-stub',
          cartId,
          sessionId,
          storeId: '',
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
          serverNow: new Date().toISOString(),
          lines: [],
          totalPaise: 0,
        },
      }
    );
  }

  async getHold(sessionId: string, holdId: string): Promise<Hold | null> {
    this.record('getHold', [sessionId, holdId]);
    if (this.delegate) return this.delegate.getHold(sessionId, holdId);
    return (this.fixture('getHold') as Hold | null | undefined) ?? null;
  }

  async releaseHold(sessionId: string, holdId: string): Promise<Hold | null> {
    this.record('releaseHold', [sessionId, holdId]);
    if (this.delegate) return this.delegate.releaseHold(sessionId, holdId);
    return (this.fixture('releaseHold') as Hold | null | undefined) ?? null;
  }

  async confirmOrder(
    sessionId: string,
    reservationId: string,
    operationKey: string,
  ): Promise<Order> {
    this.record('confirmOrder', [sessionId, reservationId, operationKey]);
    if (this.delegate)
      return this.delegate.confirmOrder(sessionId, reservationId, operationKey);
    return (
      (this.fixture('confirmOrder') as Order | undefined) ?? {
        id: 'order-stub',
        reservationId,
        storeId: '',
        status: 'CONFIRMED',
        createdAt: new Date().toISOString(),
        lines: [],
        totalPaise: 0,
        paymentMode: 'SIMULATED',
      }
    );
  }

  async getOrder(sessionId: string, orderId: string): Promise<Order | null> {
    this.record('getOrder', [sessionId, orderId]);
    if (this.delegate) return this.delegate.getOrder(sessionId, orderId);
    return (this.fixture('getOrder') as Order | null | undefined) ?? null;
  }

  async saveInterest(
    sessionId: string,
    storeId: string,
    productId: string,
  ): Promise<StockInterest> {
    this.record('saveInterest', [sessionId, storeId, productId]);
    if (this.delegate)
      return this.delegate.saveInterest(sessionId, storeId, productId);
    return (
      (this.fixture('saveInterest') as StockInterest | undefined) ?? {
        id: 'interest-stub',
        sessionId,
        storeId,
        productId,
        createdAt: new Date().toISOString(),
      }
    );
  }

  async getProductOffers(
    storeId: string,
    params?: {
      q?: string;
      category?: string;
      minPricePaise?: number;
      maxPricePaise?: number;
      city?: string;
    },
  ): Promise<ProductOffer[]> {
    this.record('getProductOffers', [storeId, params]);
    if (this.delegate)
      return this.delegate.getProductOffers(storeId, params);
    return (
      (this.fixture('getProductOffers') as ProductOffer[] | undefined) ?? []
    );
  }
}
