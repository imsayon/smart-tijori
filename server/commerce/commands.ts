import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  MAX_LINES, MAX_QUANTITY, MAX_RESTOCK,
  type Actor, type Cart, type CommerceCommands, type CommerceErrorCode, type Hold,
  type Line, type LineInput, type Order, type Outcome, type PosSale, type Store,
} from "../contracts/commerce.ts";
import type { Database } from "../db/database.ts";
import { advanceVersions, databaseTime, inventoryFacts, lockInventory, moveStock, offer } from "./inventory.ts";

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const BARCODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const OPERATION_KEY = /^[!-~]{1,128}$/;

class Rejected extends Error {
  readonly response: Extract<Outcome<never>, { ok: false }>;
  constructor(code: CommerceErrorCode, message: string, productIds?: string[]) {
    super(message);
    this.response = { ok: false, error: { code, message, ...(productIds && { productIds }) } };
  }
}

function requireActor(actor: Actor, kind: Actor["kind"], storeId?: string) {
  if (actor?.kind !== kind || typeof actor.id !== "string" || !OPERATION_KEY.test(actor.id)
      || (actor.kind === "operator" && (!Array.isArray(actor.storeIds) || !actor.storeIds.includes(storeId)))) {
    throw new Rejected("FORBIDDEN", "This actor cannot perform the operation.");
  }
}

function requireId(value: string, pattern: RegExp = SLUG) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Rejected("VALIDATION_ERROR", "Invalid identifier.");
  }
}

function requireQuantity(quantity: number, max: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
    throw new Rejected("VALIDATION_ERROR", `Quantity must be an integer between 1 and ${max}.`);
  }
}

function normalizeLines(lines: readonly LineInput[], allowEmpty = false): LineInput[] {
  if (!Array.isArray(lines) || lines.length > MAX_LINES || (!allowEmpty && !lines.length)) {
    throw new Rejected("VALIDATION_ERROR", "Invalid number of lines.");
  }
  const seen = new Set<string>();
  return lines.map((line) => {
    if (!line) throw new Rejected("VALIDATION_ERROR", "Invalid line.");
    requireId(line.productId);
    requireQuantity(line.quantity, MAX_QUANTITY);
    if (seen.has(line.productId)) throw new Rejected("VALIDATION_ERROR", "Duplicate product.");
    seen.add(line.productId);
    return { productId: line.productId, quantity: line.quantity };
  }).sort((a, b) => a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0);
}

function total(lines: readonly Line[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPricePaise, 0);
}

function productIds(lines: readonly LineInput[]): string[] {
  return lines.map((line) => line.productId);
}

function pricedLines(lines: readonly LineInput[], facts: Awaited<ReturnType<typeof inventoryFacts>>, allocate: boolean): Line[] {
  const byId = new Map(facts.map((fact) => [fact.productId, fact]));
  const unavailable = lines.filter(({ productId, quantity }) => {
    const fact = byId.get(productId);
    return !fact || (allocate && fact.available < quantity);
  });
  if (unavailable.length) {
    throw new Rejected("STOCK_UNAVAILABLE", "One or more products are unavailable at this store.", productIds(unavailable));
  }
  return lines.map((line) => {
    const fact = byId.get(line.productId)!;
    return { ...line, name: fact.name, unitPricePaise: fact.pricePaise };
  });
}

async function command<T>(db: Database, run: (client: PoolClient) => Promise<T | Outcome<T>>): Promise<Outcome<T>> {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await db.transact(run);
      if (result && typeof result === "object" && "ok" in result) return result as Outcome<T>;
      return { ok: true, value: result as T };
    } catch (error) {
      if (error instanceof Rejected) return error.response;
      const code = (error as { code?: string })?.code;
      if (attempt < 2 && (code === "40001" || code === "40P01" || code === "55P03")) continue;
      if (code?.startsWith("08") || ["40001", "40P01", "55P03", "57014", "57P01", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code ?? "")
          || (error instanceof Error && /timeout exceeded when trying to connect|connection terminated/i.test(error.message))) {
        return { ok: false, error: { code: "DEPENDENCY_UNAVAILABLE", message: "Commerce is temporarily unavailable." } };
      }
      throw error;
    }
  }
}

async function idempotent<T>(
  client: PoolClient, actor: Actor, operation: string, key: string, body: unknown, run: () => Promise<T>,
): Promise<Outcome<T>> {
  requireId(key, OPERATION_KEY);
  const fingerprint = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const scope = [actor.kind, actor.id, operation, key];
  const inserted = await client.query(`
    INSERT INTO idempotency (actor_kind, actor_id, operation, key, fingerprint) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT DO NOTHING`, [...scope, fingerprint]);
  if (!inserted.rowCount) {
    const { rows: [prior] } = await client.query<{ fingerprint: string; result: Outcome<T> }>(`
      SELECT fingerprint, result FROM idempotency WHERE (actor_kind, actor_id, operation, key) = ($1,$2,$3,$4)`, scope);
    if (prior.fingerprint !== fingerprint) {
      throw new Rejected("IDEMPOTENCY_CONFLICT", "This operation key already belongs to a different request.");
    }
    return prior.result;
  }
  await client.query("SAVEPOINT business_command");
  let result: Outcome<T>;
  try {
    result = { ok: true, value: await run() };
  } catch (error) {
    if (!(error instanceof Rejected)) throw error;
    await client.query("ROLLBACK TO SAVEPOINT business_command");
    result = error.response;
  }
  await client.query(`
    UPDATE idempotency SET result = $5 WHERE (actor_kind, actor_id, operation, key) = ($1,$2,$3,$4)`,
  [...scope, JSON.stringify(result)]);
  return result;
}

type CartRow = Pick<Cart, "id" | "storeId">;

async function lockCart(client: PoolClient, ownerId: string): Promise<CartRow> {
  await client.query("INSERT INTO carts (owner_id) VALUES ($1) ON CONFLICT DO NOTHING", [ownerId]);
  const { rows: [cart] } = await client.query<CartRow>(`
    SELECT id, store_id AS "storeId" FROM carts WHERE owner_id = $1 FOR UPDATE`, [ownerId]);
  return cart;
}

async function cartLines(client: PoolClient, cartId: string): Promise<Line[]> {
  const { rows } = await client.query<Line>(`
    SELECT p.id AS "productId", l.quantity, p.name, p.price_paise AS "unitPricePaise"
    FROM cart_lines l JOIN products p ON p.id = l.product_id
    WHERE l.cart_id = $1 ORDER BY p.id COLLATE "C"`, [cartId]);
  return rows;
}

type HoldRow = Pick<Hold, "id" | "cartId" | "storeId" | "status" | "totalPaise"> & { expiresAt: Date };

const holdColumns = 'r.id, r.cart_id AS "cartId", r.store_id AS "storeId", r.status, r.expires_at AS "expiresAt", r.total_paise AS "totalPaise"';

async function activeHold(client: PoolClient, cartId: string): Promise<HoldRow | undefined> {
  const { rows } = await client.query<HoldRow>(`
    SELECT ${holdColumns} FROM reservations r WHERE r.cart_id = $1 AND r.status = 'ACTIVE'`, [cartId]);
  return rows[0];
}

async function ownedHold(client: PoolClient, actorId: string, id: string, lock: boolean): Promise<HoldRow> {
  requireId(id, UUID);
  if (lock) {
    await client.query(`
      SELECT c.id FROM carts c JOIN reservations r ON r.cart_id = c.id
      WHERE r.id = $1 AND c.owner_id = $2 FOR UPDATE OF c`, [id, actorId]);
  }
  const { rows: [hold] } = await client.query<HoldRow>(`
    SELECT ${holdColumns} FROM reservations r JOIN carts c ON c.id = r.cart_id
    WHERE r.id = $1 AND c.owner_id = $2`, [id, actorId]);
  if (!hold) throw new Rejected("NOT_FOUND", "Hold not found.");
  return hold;
}

async function holdLines(client: PoolClient, id: string): Promise<Line[]> {
  const { rows } = await client.query<Line>(`
    SELECT product_id AS "productId", quantity, name, unit_price_paise AS "unitPricePaise"
    FROM reservation_lines WHERE reservation_id = $1 ORDER BY product_id COLLATE "C"`, [id]);
  return rows;
}

function holdDto(row: HoldRow, lines: Line[], now: Date): Hold {
  return {
    ...row,
    status: row.status === "ACTIVE" && row.expiresAt <= now ? "EXPIRED" : row.status,
    expiresAt: row.expiresAt.toISOString(),
    serverNow: now.toISOString(),
    lines,
  };
}

async function transition(client: PoolClient, row: HoldRow, status: Exclude<Hold["status"], "ACTIVE">) {
  const result = await client.query("UPDATE reservations SET status = $2 WHERE id = $1 AND status = 'ACTIVE'", [row.id, status]);
  if (result.rowCount !== 1) throw new Error("Hold transition lost its cart lock");
  row.status = status;
}

async function finishHold(client: PoolClient, row: HoldRow, lines: Line[], now: Date) {
  await transition(client, row, row.expiresAt <= now ? "EXPIRED" : "RELEASED");
  await advanceVersions(client, row.storeId, productIds(lines), now);
}

async function persistOrder(
  client: PoolClient, hold: HoldRow, lines: Line[], now: Date, paymentMode: Order["paymentMode"],
): Promise<Order> {
  await transition(client, hold, "CONSUMED");
  const { rows: [{ id }] } = await client.query<{ id: string }>(`
    INSERT INTO orders (reservation_id, created_at, total_paise, payment_mode)
    VALUES ($1, $2, $3, $4) RETURNING id`, [hold.id, now, hold.totalPaise, paymentMode]);
  await client.query(`
    INSERT INTO order_lines (order_id, product_id, quantity, name, unit_price_paise)
    SELECT $1, product_id, quantity, name, unit_price_paise FROM reservation_lines WHERE reservation_id = $2`, [id, hold.id]);
  await moveStock(client, hold.storeId, "ORDER", id, lines, now);
  await client.query("DELETE FROM cart_lines WHERE cart_id = $1", [hold.cartId]);
  await client.query(`
    INSERT INTO outbox (type, store_id, occurred_at, payload)
    VALUES ('order.placed', $1, $2, jsonb_build_object('storeId', $1::text, 'orderId', $3::text, 'productIds', $4::text[]))`,
  [hold.storeId, now, id, productIds(lines)]);
  return { id, reservationId: hold.id, storeId: hold.storeId, status: "CONFIRMED", createdAt: now.toISOString(),
    lines, totalPaise: hold.totalPaise, paymentMode };
}

export async function recordCapturedPayment(db: Database, payment: {
  id: string; providerOrderId: string; amountPaise: number; currency: string;
}) {
  await db.transact(async client => {
    const { rows: [attempt] } = await client.query<{
      reservation_id: string; owner_id: string; amount_paise: number;
    }>(`SELECT reservation_id, owner_id, amount_paise FROM payment_attempts
        WHERE provider_order_id = $1`, [payment.providerOrderId]);
    if (!attempt) return;
    if (attempt.amount_paise !== payment.amountPaise || payment.currency !== "INR") {
      throw new Error("Provider payment does not match the checkout amount or currency");
    }
    const hold = await ownedHold(client, attempt.owner_id, attempt.reservation_id, true);
    const exists = await client.query("SELECT 1 FROM payment_captures WHERE provider_payment_id = $1", [payment.id]);
    if (exists.rowCount) return;
    let orderId: string | null = null;
    if (hold.status === "ACTIVE") {
      const lines = await holdLines(client, hold.id);
      await lockInventory(client, hold.storeId, productIds(lines));
      const now = await databaseTime(client);
      if (hold.expiresAt > now) orderId = (await persistOrder(client, hold, lines, now, "RAZORPAY")).id;
    }
    await client.query(`INSERT INTO payment_captures
      (provider_payment_id, reservation_id, amount_paise, order_id, refund_status)
      VALUES ($1, $2, $3, $4, $5)`,
    [payment.id, hold.id, payment.amountPaise, orderId, orderId ? null : "pending"]);
  });
}

async function finalizePosSale(
  client: PoolClient, operatorId: string, storeId: string, lines: readonly LineInput[],
): Promise<PosSale> {
  const ids = productIds(lines);
  await lockInventory(client, storeId, ids);
  const now = await databaseTime(client);
  const facts = await inventoryFacts(client, storeId, ids, now);
  const reserved = lines.filter(({ productId, quantity }) => {
    const fact = facts.find((row) => row.productId === productId);
    return fact && quantity > fact.available && quantity <= fact.stockOnHand;
  });
  if (reserved.length) {
    throw new Rejected("STOCK_LOCKED_ONLINE", "Reserved for online checkout.", productIds(reserved));
  }

  const priced = pricedLines(lines, facts, true);
  const saleId = randomUUID();
  const totalPaise = total(priced);
  await moveStock(client, storeId, "POS", saleId, lines, now);
  const versions = new Map(facts.map(row => [row.productId, row.inventoryVersion + 1]));
  const receipt = priced.map(line => ({ ...line, inventoryVersion: versions.get(line.productId)! }));
  await client.query(`
    INSERT INTO pos_sales (id, store_id, operator_id, sold_at, total_paise, lines)
    VALUES ($1,$2,$3,$4,$5,$6)`, [saleId, storeId, operatorId, now, totalPaise, JSON.stringify(receipt)]);
  return { saleId, storeId, status: "CONFIRMED", source: "postgresql", soldAt: now.toISOString(),
    lines: receipt, totalPaise };
}

export function createCommerceCommands(db: Database): CommerceCommands {
  return {
    listStores: () => command(db, async (client) =>
      (await client.query<Store>("SELECT id, name, city FROM stores ORDER BY id")).rows),
    getCart: (actor) => command<Cart>(db, async (client) => {
      requireActor(actor, "shopper");
      const cart = await lockCart(client, actor.id);
      const lines = await cartLines(client, cart.id);
      return { ...cart, lines, totalPaise: total(lines) };
    }),
    putCart: (actor, input) => command<Cart>(db, async (client) => {
      requireActor(actor, "shopper");
      requireId(input.storeId);
      const lines = normalizeLines(input.lines, true);
      const cart = await lockCart(client, actor.id);
      const hold = await activeHold(client, cart.id);
      const heldLines = hold ? await holdLines(client, hold.id) : [];
      if (hold) await lockInventory(client, hold.storeId, productIds(heldLines));
      const now = await databaseTime(client);
      const store = await client.query("SELECT 1 FROM stores WHERE id = $1", [input.storeId]);
      if (!store.rowCount) throw new Rejected("NOT_FOUND", "Store not found.");
      const priced = pricedLines(lines, await inventoryFacts(client, input.storeId, productIds(lines), now), false);
      if (hold) await finishHold(client, hold, heldLines, now);
      await client.query("UPDATE carts SET store_id = $2 WHERE id = $1", [cart.id, input.storeId]);
      await client.query("DELETE FROM cart_lines WHERE cart_id = $1", [cart.id]);
      await client.query(`
        INSERT INTO cart_lines (cart_id, product_id, quantity)
        SELECT $1, * FROM unnest($2::text[], $3::integer[])`, [cart.id, productIds(lines), lines.map((line) => line.quantity)]);
      return { id: cart.id, storeId: input.storeId, lines: priced, totalPaise: total(priced) };
    }),
    reserve: (actor, input) => command<Hold>(db, async (client) => {
      requireActor(actor, "shopper");
      requireId(input.cartId, UUID);
      const cartId = input.cartId.toLowerCase();
      return idempotent(client, actor, "reserve", input.key, { cartId }, async () => {
        const cart = await lockCart(client, actor.id);
        if (cart.id !== cartId) throw new Rejected("NOT_FOUND", "Cart not found.");
        const lines = await cartLines(client, cart.id);
        if (!cart.storeId || !lines.length) throw new Rejected("VALIDATION_ERROR", "Choose a store and add products first.");
        const hold = await activeHold(client, cart.id);
        const heldLines = hold ? await holdLines(client, hold.id) : [];
        // Cart edits finish the old hold before changing the cart's store.
        await lockInventory(client, cart.storeId, [...productIds(lines), ...productIds(heldLines)]);
        const now = await databaseTime(client);
        if (hold && hold.expiresAt > now) return holdDto(hold, heldLines, now);
        const priced = pricedLines(lines, await inventoryFacts(client, cart.storeId, productIds(lines), now), true);
        if (hold) await finishHold(client, hold, heldLines, now);
        const { rows: [created] } = await client.query<HoldRow>(`
          INSERT INTO reservations (cart_id, store_id, status, created_at, expires_at, total_paise)
          VALUES ($1, $2, 'ACTIVE', $3::timestamptz, $3::timestamptz + interval '59 seconds', $4)
          RETURNING id, cart_id AS "cartId", store_id AS "storeId", status,
            expires_at AS "expiresAt", total_paise AS "totalPaise"`, [cart.id, cart.storeId, now, total(priced)]);
        await client.query(`
          INSERT INTO reservation_lines (reservation_id, product_id, quantity, name, unit_price_paise)
          SELECT $1, * FROM unnest($2::text[], $3::integer[], $4::text[], $5::integer[])`,
        [created.id, productIds(priced), priced.map((line) => line.quantity),
          priced.map((line) => line.name), priced.map((line) => line.unitPricePaise)]);
        await advanceVersions(client, cart.storeId, productIds(priced), now);
        return holdDto(created, priced, now);
      });
    }),
    getHold: (actor, id) => command<Hold>(db, async (client) => {
      requireActor(actor, "shopper");
      const hold = await ownedHold(client, actor.id, id, false);
      return holdDto(hold, await holdLines(client, hold.id), await databaseTime(client));
    }),
    releaseHold: (actor, id) => command<Hold>(db, async (client) => {
      requireActor(actor, "shopper");
      const hold = await ownedHold(client, actor.id, id, true);
      const lines = await holdLines(client, hold.id);
      if (hold.status === "ACTIVE") await lockInventory(client, hold.storeId, productIds(lines));
      const now = await databaseTime(client);
      if (hold.status === "ACTIVE") await finishHold(client, hold, lines, now);
      return holdDto(hold, lines, now);
    }),
    placeOrder: (actor, input) => command<Order>(db, async (client) => {
      requireActor(actor, "shopper");
      requireId(input.reservationId, UUID);
      const reservationId = input.reservationId.toLowerCase();
      return idempotent(client, actor, "order", input.key, { reservationId }, async () => {
        const hold = await ownedHold(client, actor.id, reservationId, true);
        if (hold.status === "CONSUMED") throw new Rejected("ORDER_ALREADY_PLACED", "This hold already has an order.");
        if (hold.status === "RELEASED") throw new Rejected("HOLD_NOT_ACTIVE", "This hold is no longer active.");
        const lines = await holdLines(client, hold.id);
        await lockInventory(client, hold.storeId, productIds(lines));
        const now = await databaseTime(client);
        if (hold.status === "EXPIRED" || hold.expiresAt <= now) throw new Rejected("HOLD_EXPIRED", "This hold has expired.");
        return persistOrder(client, hold, lines, now, "SIMULATED");
      });
    }),
    getOrder: (actor, id) => command<Order>(db, async (client) => {
      requireActor(actor, "shopper");
      requireId(id, UUID);
      const { rows: [row] } = await client.query<Omit<Order, "lines" | "status" | "createdAt"> & { createdAt: Date }>(`
        SELECT o.id, o.reservation_id AS "reservationId", r.store_id AS "storeId", o.created_at AS "createdAt",
          o.total_paise AS "totalPaise", o.payment_mode AS "paymentMode"
        FROM orders o JOIN reservations r ON r.id = o.reservation_id JOIN carts c ON c.id = r.cart_id
        WHERE o.id = $1 AND c.owner_id = $2`, [id, actor.id]);
      if (!row) throw new Rejected("NOT_FOUND", "Order not found.");
      const { rows: lines } = await client.query<Line>(`
        SELECT product_id AS "productId", quantity, name, unit_price_paise AS "unitPricePaise"
        FROM order_lines WHERE order_id = $1 ORDER BY product_id COLLATE "C"`, [id]);
      return { ...row, createdAt: row.createdAt.toISOString(), status: "CONFIRMED", lines };
    }),
    saveInterest: (actor, input) => command<{ saved: true }>(db, async (client) => {
      requireActor(actor, "shopper");
      requireId(input.storeId);
      requireId(input.productId);
      const exists = await client.query("SELECT 1 FROM inventory WHERE store_id = $1 AND product_id = $2", [input.storeId, input.productId]);
      if (!exists.rowCount) throw new Rejected("NOT_FOUND", "Product offer not found.");
      await client.query("INSERT INTO stock_interest (actor_id, store_id, product_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [actor.id, input.storeId, input.productId]);
      return { saved: true };
    }),
    authorizePosSale: (actor, input) => command(db, async (client) => {
      const { storeId, quantity, key } = input;
      requireActor(actor, "operator", storeId);
      requireId(storeId);
      const barcode = typeof input.barcode === "string" ? input.barcode.trim() : "";
      requireId(barcode, BARCODE);
      requireQuantity(quantity, MAX_QUANTITY);
      return idempotent(client, actor, "pos-barcode", key, { storeId, barcode, quantity }, async () => {
        const { rows: [match] } = await client.query<{ product_id: string }>(`
          SELECT b.product_id FROM product_barcodes b
          JOIN inventory i ON i.product_id = b.product_id
          WHERE b.barcode = $1 AND b.active AND i.store_id = $2 FOR SHARE OF b`, [barcode, storeId]);
        if (!match) throw new Rejected("NOT_FOUND", "Barcode is not registered for this store.");
        return finalizePosSale(client, actor.id, storeId, [{ productId: match.product_id, quantity }]);
      });
    }),
    recordPosSale: (actor, input) => command(db, async (client) => {
      requireActor(actor, "operator", input.storeId);
      requireId(input.storeId);
      const lines = normalizeLines(input.lines);
      const { storeId } = input;
      return idempotent(client, actor, "pos", input.key, { storeId, lines },
        () => finalizePosSale(client, actor.id, storeId, lines));
    }),
    restock: (actor, input) => command(db, async (client) => {
      requireActor(actor, "operator", input.storeId);
      requireId(input.storeId);
      requireId(input.productId);
      requireQuantity(input.quantity, MAX_RESTOCK);
      const { storeId, productId, quantity } = input;
      return idempotent(client, actor, "restock", input.key, { storeId, productId, quantity }, async () => {
        await lockInventory(client, storeId, [productId]);
        const now = await databaseTime(client);
        const [fact] = await inventoryFacts(client, storeId, [productId], now);
        if (!fact) throw new Rejected("NOT_FOUND", "Product offer not found.");
        if (fact.stockOnHand + quantity > 1_000_000) throw new Rejected("VALIDATION_ERROR", "Restock would exceed the inventory limit.");
        await moveStock(client, storeId, "RESTOCK", randomUUID(), [{ productId, quantity }], now);
        const [updated] = await inventoryFacts(client, storeId, [productId], now);
        return offer(updated, now);
      });
    }),
  };
}

export async function expireDueHolds(db: Database, limit: number): Promise<number> {
  requireQuantity(limit, 100);
  const due = await db.transact(async (client) =>
    (await client.query<{ cartId: string; id: string }>(`
      SELECT cart_id AS "cartId", id FROM reservations WHERE status = 'ACTIVE' AND expires_at <= clock_timestamp()
      ORDER BY expires_at, id LIMIT $1`, [limit])).rows);
  let expired = 0;
  for (const candidate of due) {
    expired += await db.transact(async (client) => {
      const lock = await client.query("SELECT id FROM carts WHERE id = $1 FOR UPDATE SKIP LOCKED", [candidate.cartId]);
      if (!lock.rowCount) return 0;
      const hold = await activeHold(client, candidate.cartId);
      if (!hold || hold.id !== candidate.id) return 0;
      const lines = await holdLines(client, hold.id);
      await lockInventory(client, hold.storeId, productIds(lines));
      const now = await databaseTime(client);
      if (hold.expiresAt > now) return 0;
      await finishHold(client, hold, lines, now);
      return 1;
    });
  }
  return expired;
}
