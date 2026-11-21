// Explicit managed-service acceptance. Each invocation creates fresh synthetic inventory.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { createKafka, createPostgresPool } from "../server/connections.ts";
import { createDatabase } from "../server/db/database.ts";
import { createCommerceCommands } from "../server/commerce/commands.ts";
import { createPipelineReader } from "../server/events/diagnostics.ts";
import { claimOutbox, markPublished } from "../server/events/outbox.ts";
import { createEventProducer, publishEvent, runWorker } from "../server/worker.ts";
import { recordingWriter } from "./fixtures/recording-writer.mjs";

const schema = "st_platform_verify_v1";
const topic = "commerce.events.platform-verify.v1";
const groupId = "st-projector-platform-verify-v1";
assert.equal(process.env.ST_DB_SCHEMA, schema);
assert.equal(process.env.KAFKA_TOPIC, topic);
assert.equal(process.env.KAFKA_GROUP_ID, groupId);
const storeId = "verify-" + randomUUID();
const pool = createPostgresPool();
// Queue all 100 callers on the same bounded two-connection pool.
pool.options.connectionTimeoutMillis = 180_000;
const db = createDatabase(pool, schema);
const commands = createCommerceCommands(db);
const kafka = createKafka();
const producer = createEventProducer(kafka);
const admin = kafka.admin();
const operator = { kind: "operator", id: storeId, storeIds: [storeId] };
const shopper = (i) => ({ kind: "shopper", id: storeId + "-" + i });
const lines = (id) => [{ productId: id, quantity: 1 }];
const pos = (id, key) => commands.authorizePosSale(operator, { storeId, barcode: "ST:" + id, quantity: 1, key });
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r.value; };
async function hold(id, i) {
  const actor = shopper(i);
  const cart = ok(await commands.putCart(actor, { storeId, lines: lines(id) }));
  return commands.reserve(actor, { cartId: cart.id, key: "reserve" });
}
async function waitFor(check, timeout = 90_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(300);
  }
  throw new Error("Managed verification deadline exceeded");
}
const stop = new AbortController();
let worker;
try {
  const carts = await db.transact(async (c) => {
    await c.query("INSERT INTO stores VALUES ($1,'Platform verification','Bengaluru')", [storeId]);
    await c.query("INSERT INTO inventory (store_id, product_id, stock_on_hand) SELECT $1,id,1 FROM products WHERE id=ANY($2)", [storeId, ["tea-250","rice-1kg","salt-1kg","coffee-100"]]);
    const { rows } = await c.query("INSERT INTO carts(owner_id,store_id) SELECT $1 || '-' || n,$1 FROM generate_series(0,49) n RETURNING id,owner_id", [storeId]);
    await c.query("INSERT INTO cart_lines SELECT id,'tea-250',1 FROM carts WHERE store_id=$1", [storeId]);
    return rows;
  });
  const race = await Promise.all(carts.flatMap((cart,i) => [
    pos("tea-250","race-"+i),
    commands.reserve({kind:"shopper",id:cart.owner_id},{cartId:cart.id,key:"race"}),
  ]));
  assert.equal(race.filter(r=>r.ok).length,1);
  assert.ok(race.every(r=>r.ok || ["STOCK_LOCKED_ONLINE","STOCK_UNAVAILABLE"].includes(r.error.code)));
  console.log(storeId, "100 contenders, 1 winner");
  const timer = ok(await hold("coffee-100","deadline"));
  const owned = ok(await hold("rice-1kg","owner"));
  assert.equal(Date.parse(owned.expiresAt)-Date.parse(owned.serverNow),300000);
  assert.equal(ok(await commands.reserve(shopper("owner"),{cartId:owned.cartId,key:"reserve"})).expiresAt,owned.expiresAt);
  assert.equal((await pos("rice-1kg","protected")).error.code,"STOCK_LOCKED_ONLINE");
  assert.equal((await commands.getHold(shopper("other"),owned.id)).error.code,"NOT_FOUND");
  const confirm = () => commands.placeOrder(shopper("owner"),{reservationId:owned.id,key:"confirm"});
  const order = ok(await confirm());
  assert.deepEqual(ok(await confirm()),order);
  const posReceipt = ok(await pos("salt-1kg","pos-first"));
  assert.deepEqual(ok(await pos("salt-1kg","pos-first")), posReceipt);
  assert.equal(posReceipt.source, "postgresql");
  assert.equal(posReceipt.lines[0].inventoryVersion, 2);
  assert.equal((await hold("salt-1kg","late")).error.code,"STOCK_UNAVAILABLE");
  await waitFor(async()=>db.transact(async c=>(await c.query("SELECT expires_at <= clock_timestamp() AS due FROM reservations WHERE id=$1",[timer.id])).rows[0].due));
  ok(await pos("coffee-100","post-expiry"));
  const stats = await db.transact(async c=>(await c.query(`
    SELECT stock_on_hand AS stock, inventory_version AS version,
      (SELECT count(*)::int FROM orders WHERE reservation_id=$2) AS orders,
      (SELECT count(*)::int FROM stock_movements WHERE reference_id=$3) AS movements
    FROM inventory WHERE store_id=$1 AND product_id='rice-1kg'`,[storeId,owned.id,order.id])).rows[0]);
  assert.deepEqual(stats,{stock:0,version:3,orders:1,movements:1});
  console.log("5m deadline, both orderings, expiry without sweep, single debit verified");
  await producer.connect();
  await admin.connect();
  const claim = await claimOutbox(db);
  assert.ok(claim);
  await publishEvent(producer,topic,claim.event);
  const poison = await producer.send({ topic, messages: [{ key: storeId, value: "not-an-event" }] });
  const poisonOffset = poison[0].baseOffset;
  await producer.disconnect();
  // Leave the broker-acknowledged claim unmarked until its real lease expires.
  await sleep(31_000);
  assert.equal(await markPublished(db,claim),false);
  const reader = createPipelineReader(db);
  let fault = true;
  const recording = recordingWriter((offer) => fault && offer.storeId===storeId ? true : undefined);
  const first = new AbortController();
  const firstRun = runWorker({db,kafka,topic,groupId,writeProjection:recording.writeProjection,signal:first.signal});
  try {
    await Promise.race([waitFor(async()=>(await reader(storeId)).projectionRetryCount>0),firstRun]);
  } finally { first.abort(); await firstRun; }
  fault = false;
  worker = runWorker({db,kafka,topic,groupId,writeProjection:recording.writeProjection,signal:stop.signal});
  const untilCaughtUp = async () => {
    const status = await reader(storeId);
    if (status.pendingCount || status.projectionRetryCount || !status.lastProjectionAcceptedAt) return false;
    const high = (await admin.fetchTopicOffsets(topic))[0].high;
    const offset = (await admin.fetchOffsets({groupId,topics:[topic]}))[0].partitions[0].offset;
    if (offset !== high) return false;
    console.log("Kafka group caught up at",offset);
    return true;
  };
  await Promise.race([worker,waitFor(untilCaughtUp)]);
  assert.equal(recording.documents.get(storeId+":rice-1kg").available,0);
  const quarantined = await db.transact(async c => (await c.query(
    "SELECT reason FROM projection_quarantine WHERE topic=$1 AND partition=0 AND message_offset=$2", [topic, poisonOffset])).rows[0]);
  assert.equal(quarantined?.reason, "INVALID_EVENT");
  console.log("PASS",storeId);
} finally {
  stop.abort();
  try { if (worker) await worker; } finally {
    await Promise.allSettled([producer.disconnect(),admin.disconnect()]);
    await pool.end();
  }
}
