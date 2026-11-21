import type { CommerceCommands as PlatformCommands } from "../../contracts/commerce";
import type { Cart, Hold, Order, StockInterest, ProductOffer, Store } from '@/contracts';

export type CreateHoldResult =
  | { ok: true; hold: Hold }
  | { ok: false; code: 'STOCK_UNAVAILABLE'; unavailableProducts: string[] };

export interface CommerceCommands {
  authorizePosSale: PlatformCommands["authorizePosSale"];

  listStores(): Promise<Store[]>;

  getCart(sessionId: string): Promise<Cart>;
  updateCart(
    sessionId: string,
    storeId: string,
    lines: Array<{ productId: string; quantity: number }>,
  ): Promise<Cart>;

  /**
   * Creates an atomic stock reservation hold for the shopper's cart.
   *
   * INTEGRATION CONTRACT REQUIREMENT (FOR SAYON'S POSTGRESQL IMPLEMENTATION):
   * 1. Duration: Must enforce exactly five minutes (300 seconds) hold expiry (`now() + interval '5 minutes'`).
   * 2. Timestamps: Return server-generated `serverNow` and `expiresAt` in ISO-8601 format.
   * 3. Idempotency: Duplicate calls with the same (sessionId, operationKey, cartFingerprint)
   *    must return the cached hold result without creating duplicate allocations.
   * 4. Single Active Hold: A repeat checkout for an unchanged cart keeps its active deadline. Editing the cart releases the hold.
   * 5. All-or-Nothing: If any line has insufficient book stock, return `{ ok: false, code: 'STOCK_UNAVAILABLE' }`.
   */
  createHold(
    sessionId: string,
    cartId: string,
    operationKey: string,
  ): Promise<CreateHoldResult>;
  getHold(sessionId: string, holdId: string): Promise<Hold | null>;
  releaseHold(sessionId: string, holdId: string): Promise<Hold | null>;

  confirmOrder(
    sessionId: string,
    reservationId: string,
    operationKey: string,
  ): Promise<Order>;
  getOrder(sessionId: string, orderId: string): Promise<Order | null>;

  saveInterest(
    sessionId: string,
    storeId: string,
    productId: string,
  ): Promise<StockInterest>;

  getProductOffers(
    storeId: string,
    params?: {
      q?: string;
      category?: string;
      minPricePaise?: number;
      maxPricePaise?: number;
      city?: string;
    },
  ): Promise<ProductOffer[]>;
}
