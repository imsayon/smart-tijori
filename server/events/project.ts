import "server-only";
import { MAX_LINES, type CommerceFacts, type ProductOffer } from "../contracts/commerce.ts";
import type { CommerceEvent, WriteProjection } from "../contracts/events.ts";
import type { Database } from "../db/database.ts";
import { eventKey } from "./outbox.ts";

interface Delivery {
  topic: string;
  partition: number;
  offset: string;
  key: Buffer | null;
  value: Buffer | null;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function slug(value: unknown): value is string {
  return typeof value === "string" && SLUG.test(value);
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function decode(delivery: Delivery): CommerceEvent | undefined {
  let value: unknown;
  try {
    if (!delivery.value || delivery.value.length > 16_384) return;
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(delivery.value));
  } catch {
    return;
  }
  if (!record(value) || value.schemaVersion !== 1 || !uuid(value.eventId)
      || typeof value.occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.occurredAt)
      || !Number.isFinite(Date.parse(value.occurredAt)) || new Date(value.occurredAt).toISOString() !== value.occurredAt
      || !record(value.payload) || !slug(value.payload.storeId)) return;

  const { payload } = value;
  if (value.type === "inventory.changed") {
    if (!slug(payload.productId) || typeof payload.inventoryVersion !== "number"
        || !Number.isSafeInteger(payload.inventoryVersion) || payload.inventoryVersion < 1) return;
  } else if (value.type === "order.placed") {
    if (!uuid(payload.orderId) || !Array.isArray(payload.productIds) || !payload.productIds.length
        || payload.productIds.length > MAX_LINES || !payload.productIds.every(slug)
        || new Set(payload.productIds).size !== payload.productIds.length) return;
  } else {
    return;
  }

  const event = value as CommerceEvent;
  return delivery.key?.equals(Buffer.from(eventKey(event))) ? event : undefined;
}

type Failure = "WRITER_UNAVAILABLE" | "WRITER_INVALID_RESULTS" | "WRITER_RETRYABLE" | "WRITER_PERMANENT";

async function projectOffers(
  writer: WriteProjection, offers: readonly ProductOffer[], signal?: AbortSignal,
): Promise<Failure | undefined> {
  let results;
  try {
    results = await writer(offers, signal);
  } catch {
    return "WRITER_UNAVAILABLE";
  }
  const expected = new Set(offers.map((offer) => `${offer.storeId}:${offer.productId}`));
  let retryable = false;
  let permanent = false;
  if (!Array.isArray(results)) return "WRITER_INVALID_RESULTS";
  for (const result of results) {
    if (!result || !expected.delete(result.documentId)) return "WRITER_INVALID_RESULTS";
    if (result.status === "applied" || result.status === "unchanged") continue;
    if (result.status !== "failed" || typeof result.retryable !== "boolean") return "WRITER_INVALID_RESULTS";
    if (result.retryable) retryable = true;
    else permanent = true;
  }
  if (expected.size) return "WRITER_INVALID_RESULTS";
  if (retryable) return "WRITER_RETRYABLE";
  if (permanent) return "WRITER_PERMANENT";
}

async function quarantine(db: Database, delivery: Delivery, reason: string, event?: CommerceEvent) {
  const location = [delivery.topic, delivery.partition, delivery.offset];
  await db.transact(async (client) => {
    await client.query(`
      INSERT INTO projection_quarantine (topic, partition, message_offset, raw_key, raw_value, reason, event_id, store_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
    [...location, delivery.key, delivery.value, reason, event?.eventId ?? null, event?.payload.storeId ?? null]);
    await client.query("DELETE FROM projection_retry WHERE (topic, partition, message_offset) = ($1,$2,$3)", location);
  });
}

async function recordProjection(db: Database, delivery: Delivery, storeId: string, failure?: string) {
  const location = [delivery.topic, delivery.partition, delivery.offset];
  await db.transact(async (client) => {
    if (failure) {
      await client.query(`
        INSERT INTO projection_retry (topic, partition, message_offset, store_id, reason)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (topic, partition, message_offset) DO UPDATE SET
          reason = excluded.reason, failed_at = clock_timestamp()`, [...location, storeId, failure]);
      return;
    }
    await client.query(`
      INSERT INTO projection_progress (store_id, last_accepted_at)
      VALUES ($1, clock_timestamp())
      ON CONFLICT (store_id) DO UPDATE SET last_accepted_at = clock_timestamp()`, [storeId]);
    await client.query("DELETE FROM projection_retry WHERE (topic, partition, message_offset) = ($1,$2,$3)", location);
  });
}

export async function handleDelivery(
  db: Database, readProductFacts: CommerceFacts["readProductFacts"], writer: WriteProjection,
  delivery: Delivery, signal?: AbortSignal,
): Promise<"accepted" | "quarantined" | "retry"> {
  const event = decode(delivery);
  if (!event) {
    await quarantine(db, delivery, "INVALID_EVENT");
    return "quarantined";
  }
  const { storeId } = event.payload;
  const ids = event.type === "order.placed" ? event.payload.productIds : [event.payload.productId];
  const offers = await readProductFacts(storeId, ids);
  if (offers.length !== ids.length
      || (event.type === "inventory.changed" && offers[0].inventoryVersion < event.payload.inventoryVersion)) {
    await quarantine(db, delivery, "EVENT_FACTS_MISMATCH", event);
    return "quarantined";
  }

  const failure = await projectOffers(writer, offers, signal);
  if (signal?.aborted) return "retry";
  if (failure === "WRITER_PERMANENT") {
    await quarantine(db, delivery, failure, event);
    return "quarantined";
  }
  await recordProjection(db, delivery, storeId, failure);
  return failure ? "retry" : "accepted";
}

// Use current database truth with the same version checks when rebuilding after retention loss.
export async function rebuildStoreProjection(
  db: Database, facts: CommerceFacts, writer: WriteProjection, storeId: string, signal?: AbortSignal,
): Promise<number> {
  let afterProductId = "";
  let count = 0;
  for (;;) {
    signal?.throwIfAborted();
    const ids = await db.transact(async (client) =>
      (await client.query<{ product_id: string }>(`
        SELECT product_id FROM inventory WHERE store_id = $1 AND product_id COLLATE "C" > $2
        ORDER BY product_id COLLATE "C" LIMIT 100`, [storeId, afterProductId])).rows.map((row) => row.product_id));
    if (!ids.length) return count;
    const offers = await facts.readProductFacts(storeId, ids);
    if (offers.length !== ids.length) throw new Error("Catalog changed during rebuild");
    const failure = await projectOffers(writer, offers, signal);
    if (failure) throw new Error(failure);
    afterProductId = ids[ids.length - 1];
    count += offers.length;
  }
}
