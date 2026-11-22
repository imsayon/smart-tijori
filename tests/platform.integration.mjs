import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { after, before, test } from "node:test";
import { KafkaJS } from "@confluentinc/kafka-javascript";
import { Pool } from "pg";
import { createCommerceCommands, expireDueHolds } from "../server/commerce/commands.ts";
import { createCommerceFacts } from "../server/commerce/facts.ts";
import { createDatabase } from "../server/db/database.ts";
import { migrate } from "../server/db/migrate.ts";
import { createPipelineReader } from "../server/events/diagnostics.ts";
import { claimOutbox, markPublished, relayOnce } from "../server/events/outbox.ts";
import { rebuildStoreProjection } from "../server/events/project.ts";
import { createEventProducer, publishEvent, runWorker } from "../server/worker.ts";
import { recordingWriter } from "./fixtures/recording-writer.mjs";

const storeId = "blr-01";
const schema = process.env.ST_TEST_SCHEMA ?? "st_platform_local";
const topic = process.env.ST_TEST_TOPIC ?? "commerce.events.platform-local.v1";
const groupId = process.env.ST_TEST_GROUP ?? "st-projector-platform-local-v1";
const pool = new Pool({
  connectionString: "postgres://platform:local-platform-only@127.0.0.1:15439/platform",
  max: 12, connectionTimeoutMillis: 2_000,
});
const kafka = new KafkaJS.Kafka({
  kafkaJS: { brokers: ["127.0.0.1:19093"], clientId: "st-platform-test", logLevel: KafkaJS.logLevel.NOTHING },
});
const db = createDatabase(pool, schema);
const commands = createCommerceCommands(db);
const facts = createCommerceFacts(db);
const pipeline = createPipelineReader(db);
const operator = { kind: "operator", id: "platform-operator", storeIds: [storeId] };
const shopper = (id) => ({ kind: "shopper", id });
const lines = (...entries) => entries.map(([productId, quantity = 1]) => ({ productId, quantity }));
const query = (sql, params = []) => db.transact((client) => client.query(sql, params));
const rows = async (sql, params) => (await query(sql, params)).rows;

function ok(outcome) {
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  return outcome.value;
}

function conflict(outcome, code) {
  assert.equal(outcome.ok, false, JSON.stringify(outcome));
  assert.equal(outcome.error.code, code);
}

async function cartFor(actor, productLines, branch = storeId) {
  return ok(await commands.putCart(actor, { storeId: branch, lines: productLines }));
}

async function reserveFor(actor, productLines) {
  const cart = await cartFor(actor, productLines);
  return ok(await commands.reserve(actor, { cartId: cart.id, key: "reserve" }));
}

async function waitFor(check, label, timeout = 20_000) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    const result = await check();
    if (result) return result;
    await sleep(40);
  }
  assert.fail(`Timed out waiting for ${label}`);
}

async function counts() {
  return (await rows(`SELECT
    (SELECT count(*)::int FROM reservations) AS holds,
    (SELECT count(*)::int FROM orders) AS orders,
    (SELECT count(*)::int FROM stock_movements) AS movements,
    (SELECT count(*)::int FROM outbox) AS events`))[0];
}

async function setDeadline(id, interval) {
  return (await rows(`
    WITH clock AS (SELECT date_trunc('milliseconds', clock_timestamp()) + $2::interval AS deadline)
    UPDATE reservations SET created_at = deadline - interval '59 seconds', expires_at = deadline
    FROM clock WHERE id = $1 RETURNING expires_at`, [id, interval]))[0].expires_at;
}

before(async () => {
  const { rows: [state] } = await pool.query("SELECT to_regnamespace($1) AS schema", [schema]);
  assert.equal(state.schema, null, "Start with a fresh disposable platform database");
  await migrate(pool, schema, true);
  await migrate(pool, schema, true);
});
after(() => pool.end());

test("seed, owned carts and holds, nonrenewal, rollback and idempotent interest", async () => {
  assert.deepEqual(ok(await commands.listStores()).map((store) => store.id), ["blr-01", "mys-01"]);
  assert.equal((await facts.readOpsFacts(storeId)).stock.length, 24);
  assert.deepEqual(await facts.readProductFacts(storeId, ["missing"]), []);
  const alice = shopper("alice");
  const bob = shopper("bob");
  assert.deepEqual(ok(await commands.getCart(alice)).lines, []);
  assert.equal(ok(await commands.getCart(alice)).storeId, null);
  const cart = await cartFor(alice, lines(["detergent-front-15l"], ["tea-500"]), "mys-01");
  assert.equal(cart.totalPaise, 54_900);
  assert.equal((await facts.readProductFacts("mys-01", ["tea-500"]))[0].available, 8);
  conflict(await commands.reserve(bob, { cartId: cart.id, key: "other" }), "NOT_FOUND");
  conflict(await commands.reserve(alice, { cartId: cart.id, key: "bad" }), "STOCK_UNAVAILABLE");
  assert.deepEqual(await counts(), { holds: 0, orders: 0, movements: 0, events: 0 });

  await cartFor(alice, lines(["tea-500"]), "mys-01");
  const hold = ok(await commands.reserve(alice, { cartId: cart.id, key: "good" }));
  assert.equal(Date.parse(hold.expiresAt) - Date.parse(hold.serverNow), 59_000);
  assert.deepEqual(ok(await commands.reserve(alice, { cartId: cart.id, key: "good" })), hold);
  assert.equal(ok(await commands.reserve(alice, { cartId: cart.id, key: "also-good" })).expiresAt, hold.expiresAt);
  conflict(await commands.reserve(alice, { cartId: randomUUID(), key: "good" }), "IDEMPOTENCY_CONFLICT");
  conflict(await commands.releaseHold(bob, hold.id), "NOT_FOUND");
  conflict(await commands.getHold(bob, hold.id), "NOT_FOUND");
  conflict(await commands.placeOrder(bob, { reservationId: hold.id, key: "other" }), "NOT_FOUND");
  conflict(await commands.putCart(alice, { storeId: "mys-01", lines: lines(["tea-500", 100]) }), "VALIDATION_ERROR");
  assert.equal(ok(await commands.getHold(alice, hold.id)).status, "ACTIVE");
  await cartFor(alice, lines(["tea-250"]), storeId);
  const released = ok(await commands.releaseHold(alice, hold.id));
  assert.equal(released.status, "RELEASED");
  assert.deepEqual(released.lines, hold.lines);
  assert.equal((await facts.readProductFacts("mys-01", ["tea-500"]))[0].available, 8);

  const interest = { storeId: "mys-01", productId: "detergent-front-15l" };
  assert.deepEqual(ok(await commands.saveInterest(alice, interest)), { saved: true });
  ok(await commands.saveInterest(alice, interest));
  assert.equal((await rows("SELECT count(*)::int AS count FROM stock_interest"))[0].count, 1);
});

test("100 concurrent synthetic allocation commands yield only one winner", async (t) => {
  const productLines = lines(["tea-250"]);
  const shoppers = Array.from({ length: 50 }, (_, i) => shopper(`contender-${i}`));
  const carts = await Promise.all(shoppers.map((actor) => cartFor(actor, productLines)));
  const before = await counts();
  const results = await Promise.all(shoppers.flatMap((actor, i) => [
    commands.reserve(actor, { cartId: carts[i].id, key: "race" }),
    commands.authorizePosSale(operator, { storeId, barcode: "ST:tea-250", quantity: 1, key: `race-${i}` }),
  ]));
  assert.equal(results.filter((result) => result.ok).length, 1);
  results.filter((result) => !result.ok).forEach((result) => assert.ok(["STOCK_LOCKED_ONLINE", "STOCK_UNAVAILABLE"].includes(result.error.code)));
  const [stock] = (await facts.readOpsFacts(storeId)).stock.filter((row) => row.productId === "tea-250");
  assert.equal(stock.available, 0);
  assert.equal(stock.stockOnHand - stock.held, 0);
  assert.equal(stock.inventoryVersion, 2);
  const post = await counts();
  assert.equal(post.events - before.events, 1);
  assert.equal(post.movements - before.movements + post.holds - before.holds, 1);
  assert.equal(post.orders, before.orders);
  t.diagnostic(`100 attempts, one ${stock.held ? "hold" : "POS"} winner, availability 0, one outbox record`);
  await assert.rejects(query("UPDATE inventory SET stock_on_hand = -1 WHERE store_id = $1 AND product_id = 'tea-250'", [storeId]), { code: "23514" });
});

let confirmedOrder;

test("atomic order, stock movements, versions and outbox survive rollback and lost responses", async () => {
  const actor = shopper("order-owner");
  const productLines = lines(["dish-liquid-500"], ["dish-liquid-1l", 2]);
  const hold = await reserveFor(actor, productLines);
  const before = await counts();
  const beforeStock = (await facts.readOpsFacts(storeId)).stock;

  await query("ALTER TABLE outbox ADD CONSTRAINT test_fail_order_event CHECK (type <> 'order.placed') NOT VALID");
  try {
    await assert.rejects(commands.placeOrder(actor, { reservationId: hold.id, key: "confirm" }), { code: "23514" });
  } finally {
    await query("ALTER TABLE outbox DROP CONSTRAINT test_fail_order_event");
  }
  assert.deepEqual(await counts(), before);
  assert.deepEqual((await facts.readOpsFacts(storeId)).stock, beforeStock);
  assert.equal(ok(await commands.getHold(actor, hold.id)).status, "ACTIVE");

  const confirm = () => commands.placeOrder(actor, { reservationId: hold.id, key: "confirm" });
  const [first, ...others] = await Promise.all(Array.from({ length: 12 }, confirm));
  confirmedOrder = ok(first);
  others.forEach((result) => assert.deepEqual(result, first));
  assert.deepEqual(await confirm(), first);
  assert.equal(confirmedOrder.paymentMode, "SIMULATED");
  assert.equal(confirmedOrder.totalPaise, 46_700);
  assert.deepEqual(ok(await commands.getOrder(actor, confirmedOrder.id)), confirmedOrder);
  conflict(await commands.getOrder(shopper("stranger"), confirmedOrder.id), "NOT_FOUND");
  conflict(await commands.placeOrder(actor, { reservationId: hold.id, key: "another" }), "ORDER_ALREADY_PLACED");
  conflict(await commands.placeOrder(actor, { reservationId: randomUUID(), key: "confirm" }), "IDEMPOTENCY_CONFLICT");
  assert.deepEqual(await counts(), {
    holds: before.holds, orders: before.orders + 1, movements: before.movements + 2, events: before.events + 3,
  });
  await assert.rejects(query(`INSERT INTO orders (reservation_id, created_at, total_paise, payment_mode)
    VALUES ($1, clock_timestamp(), 1, 'SIMULATED')`, [hold.id]), { code: "23505" });
  await migrate(pool, schema, true);
  const stock = await facts.readProductFacts(storeId, ["dish-liquid-500", "dish-liquid-1l"]);
  assert.deepEqual(stock.map((offer) => [offer.available, offer.inventoryVersion]), [[6, 3], [7, 3]]);
});

test("authorized POS and restock use stable locks and retry keys", async () => {
  const protectedActor = shopper("protected");
  await reserveFor(protectedActor, lines(["detergent-front-1l"]));
  conflict(await commands.recordPosSale(operator, { storeId, key: "protected", lines: lines(["detergent-front-1l"], ["tea-500"]) }), "STOCK_LOCKED_ONLINE");
  assert.equal((await facts.readProductFacts(storeId, ["tea-500"]))[0].available, 8);
  conflict(await commands.restock(protectedActor, { storeId, productId: "tea-500", quantity: 1, key: "restock" }), "FORBIDDEN");
  conflict(await commands.restock(operator, { storeId: "mys-01", productId: "tea-500", quantity: 1, key: "restock" }), "FORBIDDEN");
  conflict(await commands.restock(operator, { storeId, productId: "tea-500", quantity: 1001, key: "restock" }), "VALIDATION_ERROR");
  const a = lines(["rice-1kg"], ["oats-500"]);
  const b = [...a].reverse();
  const [one, two] = await Promise.all([
    commands.recordPosSale(operator, { storeId, key: "pos-a", lines: a }),
    commands.recordPosSale(operator, { storeId, key: "pos-b", lines: b }),
  ]);
  assert.notEqual(ok(one).saleId, ok(two).saleId);
  assert.deepEqual(await commands.recordPosSale(operator, { storeId, key: "pos-a", lines: b }), one);
  conflict(await commands.recordPosSale(operator, { storeId, key: "pos-a", lines: lines(["rice-1kg"]) }), "IDEMPOTENCY_CONFLICT");
  const restock = { storeId, productId: "tea-500", quantity: 2, key: "restock" };
  const result = await commands.restock(operator, restock);
  assert.equal(ok(result).available, 10);
  assert.deepEqual(await commands.restock(operator, restock), result);
  conflict(await commands.restock(operator, { ...restock, quantity: 3 }), "IDEMPOTENCY_CONFLICT");
});

test("barcode checkout snapshots price and version, enforces branch access, and replays the receipt", async () => {
  const input = { storeId, barcode: "ST:coffee-100", quantity: 1, key: "barcode-sale" };
  conflict(await commands.authorizePosSale(shopper("guest"), input), "FORBIDDEN");
  conflict(await commands.authorizePosSale(operator, { ...input, storeId: "mys-01" }), "FORBIDDEN");
  conflict(await commands.authorizePosSale(operator, { ...input, barcode: "00001001", key: "unknown" }), "NOT_FOUND");
  await query("UPDATE product_barcodes SET active=false WHERE barcode=$1", [input.barcode]);
  conflict(await commands.authorizePosSale(operator, { ...input, key: "inactive" }), "NOT_FOUND");
  await query("UPDATE product_barcodes SET active=true WHERE barcode=$1", [input.barcode]);
  const [offer] = await facts.readProductFacts(storeId, ["coffee-100"]);
  const result = await commands.authorizePosSale(operator, input);
  const sale = ok(result);
  assert.equal(sale.source, "postgresql");
  assert.equal(sale.totalPaise, offer.pricePaise);
  assert.deepEqual(sale.lines, [{
    productId: offer.productId, quantity: 1, name: offer.name,
    unitPricePaise: offer.pricePaise, inventoryVersion: offer.inventoryVersion + 1,
  }]);
  await query("UPDATE products SET price_paise=price_paise+100 WHERE id='coffee-100'");
  assert.deepEqual(await commands.authorizePosSale(operator, { ...input, barcode: input.barcode + "\n" }), result);
  conflict(await commands.authorizePosSale(operator, { ...input, quantity: 2 }), "IDEMPOTENCY_CONFLICT");
  const [receipt] = await rows(`
    SELECT p.sold_at, p.lines, p.operator_id, m.quantity_delta, o.payload
    FROM pos_sales p
    JOIN stock_movements m ON m.reference_id=p.id
    JOIN outbox o ON o.store_id=p.store_id AND o.payload->>'productId'=m.product_id
      AND (o.payload->>'inventoryVersion')::int=$2
    WHERE p.id=$1`, [sale.saleId, sale.lines[0].inventoryVersion]);
  assert.equal(receipt.sold_at.toISOString(), sale.soldAt);
  assert.equal(receipt.operator_id, operator.id);
  assert.deepEqual(receipt.lines, sale.lines);
  assert.equal(receipt.quantity_delta, -1);
  assert.equal(receipt.payload.inventoryVersion, sale.lines[0].inventoryVersion);
});

test("database deadline wins while waiting for a lock, with and without expiry cleanup", async () => {
  const actor = shopper("expiry-confirm");
  const hold = await reserveFor(actor, lines(["salt-1kg", 8]));
  const deadline = await setDeadline(hold.id, "900 milliseconds");
  let confirmation;
  await db.transact(async (client) => {
    await client.query("SELECT 1 FROM inventory WHERE store_id = $1 AND product_id = 'salt-1kg' FOR UPDATE", [storeId]);
    confirmation = commands.placeOrder(actor, { reservationId: hold.id, key: "too-late" });
    await waitFor(async () => (await rows(`
      SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock'
      AND query LIKE '%ORDER BY product_id COLLATE "C" FOR UPDATE%'`)).length, "confirmation to wait on stock", 700);
    await client.query("SELECT pg_sleep(greatest(0, extract(epoch FROM $1::timestamptz - clock_timestamp())) + 0.02)", [deadline]);
  });
  conflict(await confirmation, "HOLD_EXPIRED");
  assert.equal((await rows("SELECT status FROM reservations WHERE id = $1", [hold.id]))[0].status, "ACTIVE");
  assert.equal((await facts.readProductFacts(storeId, ["salt-1kg"]))[0].available, 8);
  ok(await commands.authorizePosSale(operator, { storeId, barcode: "ST:salt-1kg", quantity: 8, key: "after-deadline" }));
  const [sweep, edit] = await Promise.all([
    expireDueHolds(db, 24),
    commands.putCart(actor, { storeId, lines: lines(["dal-1kg"]) }),
  ]);
  assert.ok(sweep === 0 || sweep === 1);
  assert.equal(ok(edit).lines[0].productId, "dal-1kg");
  assert.equal(ok(await commands.getHold(actor, hold.id)).status, "EXPIRED");
  assert.equal((await facts.readProductFacts(storeId, ["salt-1kg"]))[0].inventoryVersion, 4);
  assert.equal(await expireDueHolds(db, 24), 0);

  const late = await reserveFor(shopper("expire-v-confirm"), lines(["coffee-100"]));
  await setDeadline(late.id, "-1 second");
  const [cleanup, lateConfirmation] = await Promise.all([
    expireDueHolds(db, 24),
    commands.placeOrder(shopper("expire-v-confirm"), { reservationId: late.id, key: "expired" }),
  ]);
  conflict(lateConfirmation, "HOLD_EXPIRED");
  assert.equal(cleanup + await expireDueHolds(db, 24), 1);
  assert.equal(ok(await commands.getHold(shopper("expire-v-confirm"), late.id)).status, "EXPIRED");
});

test("Kafka acknowledgment, stale leases, duplicates, restart, partial failures and quarantine", { timeout: 100_000 }, async (t) => {
  assert.ok(confirmedOrder);
  let producer = createEventProducer(kafka);
  const admin = kafka.admin();
  const stopFirst = new AbortController();
  const stopSecond = new AbortController();
  const workers = [];
  const start = (writer, signal) => {
    const worker = runWorker({ db, kafka, topic, groupId, writeProjection: writer.writeProjection, signal });
    worker.catch(() => {});
    workers.push(worker);
    return worker;
  };

  try {
    await producer.connect();
    await admin.connect();
    assert.equal((await admin.fetchTopicOffsets(topic))[0].high, "0", "Start with a fresh disposable topic");

    // A failed transport call must leave pending work and persist an operator-readable code.
    assert.equal(await relayOnce(db, async () => { throw new Error("fixture broker failure"); }), true);
    assert.equal((await pipeline("mys-01")).lastError?.code, "BROKER_PUBLISH_FAILED");
    await query("UPDATE outbox SET retry_at = clock_timestamp() WHERE last_error IS NOT NULL");

    const claim = await claimOutbox(db);
    assert.ok(claim);
    const overlap = await claimOutbox(db);
    assert.ok(overlap);
    assert.notEqual(overlap.event.eventId, claim.event.eventId);
    await publishEvent(producer, topic, claim.event);
    await producer.disconnect();
    producer = createEventProducer(kafka);
    await producer.connect();
    assert.equal((await rows("SELECT published_at FROM outbox WHERE id = $1", [claim.event.eventId]))[0].published_at, null);
    await query("UPDATE outbox SET lease_until = clock_timestamp() - interval '1 second' WHERE id = $1", [claim.event.eventId]);
    assert.equal(await markPublished(db, claim), false);
    const restartedClaim = await claimOutbox(db);
    assert.equal(restartedClaim.event.eventId, claim.event.eventId);
    assert.notEqual(restartedClaim.token, claim.token);
    assert.equal(await markPublished(db, claim), false);
    await publishEvent(producer, topic, restartedClaim.event);
    assert.equal(await markPublished(db, restartedClaim), true);
    assert.equal((await admin.fetchTopicOffsets(topic))[0].high, "2");
    await query("UPDATE outbox SET lease_until = clock_timestamp() - interval '1 second' WHERE id = $1", [overlap.event.eventId]);

    const occurredAt = new Date().toISOString();
    await publishEvent(producer, topic, {
      eventId: randomUUID(), schemaVersion: 1, type: "order.placed", occurredAt,
      payload: { storeId, orderId: confirmedOrder.id, productIds: confirmedOrder.lines.map((line) => line.productId) },
    });
    await publishEvent(producer, topic, {
      eventId: randomUUID(), schemaVersion: 1, type: "inventory.changed", occurredAt,
      payload: { storeId: "mys-01", productId: "salt-1kg", inventoryVersion: 1 },
    });
    await producer.send({ topic, messages: [{ key: "malformed", value: "{broken" }] });

    const first = recordingWriter((offer, offers) =>
      offers.length === 2 && offer.productId === "dish-liquid-500" ? true : undefined);
    const committed = async () => Number((await admin.fetchOffsets({ groupId, topics: [topic], timeout: 4_000 }))[0].partitions[0].offset);
    const firstRun = start(first, stopFirst.signal);
    await waitFor(async () => (await pipeline(storeId)).lastError?.code === "WRITER_RETRYABLE", "durable partial writer diagnostic");
    const projectedIdentity = (offer) => [offer.storeId, offer.productId, offer.available, offer.inventoryVersion];
    assert.deepEqual(first.calls[0].map(projectedIdentity), first.calls[1].map(projectedIdentity));
    assert.equal(first.calls[0][0].inventoryVersion, 3, "old events hydrate current facts");
    assert.equal((await pipeline(storeId)).projectionRetryCount, 1);
    assert.equal(await committed(), 2, "the partial order at offset 2 is still uncommitted");
    assert.equal(first.documents.get("blr-01:dish-liquid-1l").inventoryVersion, 3);
    assert.ok(!first.documents.has("blr-01:dish-liquid-500"));
    stopFirst.abort();
    await firstRun;

    // Carry forward the indexed versions, just as an external index outlives its worker.
    let rejectedBatch = false;
    const second = recordingWriter((offer) => offer.storeId === "mys-01" && offer.productId === "salt-1kg" ? false : undefined);
    for (const [id, offer] of first.documents) second.documents.set(id, offer);
    const writeProjection = second.writeProjection;
    second.writeProjection = async (offers) => {
      const results = await writeProjection(offers);
      if (!rejectedBatch && offers.length === 2) {
        rejectedBatch = true;
        return results.slice(0, 1);
      }
      return results;
    };
    const secondRun = start(second, stopSecond.signal);
    await waitFor(async () => {
      const [blr, mys] = await Promise.all([pipeline(storeId), pipeline("mys-01")]);
      if (blr.pendingCount || mys.pendingCount || mys.quarantineCount !== 1 || blr.unattributedQuarantineCount !== 1) return false;
      return await committed() === Number((await admin.fetchTopicOffsets(topic))[0].high);
    }, "broker and writer catch-up");
    stopSecond.abort();
    await secondRun;
    assert.ok(rejectedBatch);
    assert.ok(second.calls.filter((offers) => offers.length === 2).length >= 2, "incomplete writer reports are retried");
    assert.equal(second.documents.get("blr-01:dish-liquid-500").inventoryVersion, 3);
    const [blr, mys] = await Promise.all([pipeline(storeId), pipeline("mys-01")]);
    assert.equal(blr.projectionRetryCount, 0);
    assert.ok(blr.lastBrokerAckAt && blr.lastProjectionAcceptedAt && !blr.oldestPendingAt);
    assert.equal(mys.lastError.code, "WRITER_PERMANENT");
    assert.deepEqual((await rows("SELECT reason FROM projection_quarantine ORDER BY message_offset")).map((row) => row.reason),
      ["WRITER_PERMANENT", "INVALID_EVENT"]);
    assert.equal((await rows("SELECT count(*)::int AS count FROM orders"))[0].count, 1);
    assert.equal((await rows("SELECT count(*)::int AS count FROM stock_movements WHERE kind = 'ORDER'"))[0].count, 2);
    const rebuilt = recordingWriter();
    assert.equal(await rebuildStoreProjection(db, facts, rebuilt.writeProjection, storeId), 24);
    assert.equal(rebuilt.documents.get("blr-01:dish-liquid-500").inventoryVersion, 3);
    t.diagnostic(`Replay resumed at offset 2, caught up at ${await committed()}, quarantined 2, rebuilt 24 offers`);
  } finally {
    stopFirst.abort();
    stopSecond.abort();
    await Promise.allSettled([...workers, producer.disconnect(), admin.disconnect()]);
  }
});

test("illustrative nationwide store seed is valid, idempotent and assortment-specific", async () => {
  const fixture = await readFile(new URL("../server/db/seed-india-demo.sql", import.meta.url), "utf8");
  await query(fixture);
  const [first] = await rows(`SELECT
    (SELECT count(*)::int FROM stores WHERE id LIKE 'dm-%') AS stores,
    (SELECT count(*)::int FROM products WHERE id LIKE 'demo-%') AS products,
    (SELECT count(*)::int FROM inventory WHERE store_id LIKE 'dm-%') AS offers`);
  assert.equal(first.stores, 55);
  assert.equal(first.products, 49);
  assert.ok(first.offers > 100);
  const fishRows = await rows(`
    SELECT p.purpose FROM inventory i JOIN products p ON p.id = i.product_id
    WHERE i.store_id = 'dm-kol-gar-fs'`);
  assert.ok(fishRows.length >= 2);
  assert.ok(fishRows.every(row => ['fresh-fish','fresh-seafood','drinking-water'].includes(row.purpose)));
  await query(fixture);
  const [second] = await rows(`SELECT
    (SELECT count(*)::int FROM stores WHERE id LIKE 'dm-%') AS stores,
    (SELECT count(*)::int FROM products WHERE id LIKE 'demo-%') AS products,
    (SELECT count(*)::int FROM inventory WHERE store_id LIKE 'dm-%') AS offers`);
  assert.deepEqual(second, first, "Repeating seed must not overwrite or duplicate existing commerce rows");
});
