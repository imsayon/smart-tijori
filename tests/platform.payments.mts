import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createCommerceCommands, recordCapturedPayment } from '../server/commerce/commands.ts';
import { createCommerceFacts } from '../server/commerce/facts.ts';
import { createDatabase } from '../server/db/database.ts';
import { migrate } from '../server/db/migrate.ts';

const pool = new Pool({
  connectionString: 'postgres://platform:local-platform-only@127.0.0.1:15439/platform',
  connectionTimeoutMillis: 2_000,
});
const schema = `st_payments_${randomUUID().replaceAll('-', '')}`;
const db = createDatabase(pool, schema);
const commands = createCommerceCommands(db);
const facts = createCommerceFacts(db);
const store = 'blr-01';
const product = 'tea-250';

function ok<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  assert(result.ok, JSON.stringify(result));
  return result.value;
}

async function holdFor(owner: string, providerOrderId: string) {
  const actor = { kind: 'shopper' as const, id: owner };
  const cart = ok(await commands.putCart(actor, { storeId: store, lines: [{ productId: product, quantity: 1 }] }));
  const hold = ok(await commands.reserve(actor, { cartId: cart.id, key: randomUUID() }));
  await db.transact(client => client.query(
    'INSERT INTO payment_attempts (reservation_id, owner_id, amount_paise, provider_order_id) VALUES ($1,$2,$3,$4)',
    [hold.id, owner, hold.totalPaise, providerOrderId],
  ));
  return hold;
}

try {
  await migrate(pool, schema, true);

  const hold = await holdFor('payment-shopper', 'order_paid');
  await assert.rejects(recordCapturedPayment(db, {
    id: 'pay_wrong', providerOrderId: 'order_paid', amountPaise: hold.totalPaise - 1, currency: 'INR',
  }), /does not match/);
  const payment = { id: 'pay_one', providerOrderId: 'order_paid', amountPaise: hold.totalPaise, currency: 'INR' };
  await Promise.all([recordCapturedPayment(db, payment), recordCapturedPayment(db, payment)]);
  const results = await db.transact(client => client.query<{
    order_id: string; payment_mode: string; refund_status: string | null;
  }>(`SELECT c.order_id, o.payment_mode, c.refund_status FROM payment_captures c JOIN orders o ON o.id = c.order_id
       WHERE c.reservation_id = $1`, [hold.id]));
  assert.equal(results.rowCount, 1);
  assert.equal(results.rows[0].payment_mode, 'RAZORPAY');
  assert.equal(results.rows[0].refund_status, null);
  assert.equal((await facts.readProductFacts(store, [product]))[0].available, 0);
  const operator = { kind: 'operator' as const, id: 'test-clerk', storeIds: [store] };
  ok(await commands.restock(operator, { storeId: store, productId: product, quantity: 1, key: randomUUID() }));

  const expired = await holdFor('late-shopper', 'order_late');
  await db.transact(client => client.query(
    `WITH past AS (SELECT date_trunc('milliseconds', clock_timestamp()) - interval '1 minute' AS deadline)
      UPDATE reservations SET created_at = past.deadline - make_interval(secs => duration_seconds),
        expires_at = past.deadline FROM past WHERE id = $1`,
    [expired.id],
  ));
  await recordCapturedPayment(db, { id: 'pay_late', providerOrderId: 'order_late', amountPaise: expired.totalPaise, currency: 'INR' });
  const refunds = await db.transact(client => client.query(
    'SELECT order_id, refund_status FROM payment_captures WHERE reservation_id = $1', [expired.id],
  ));
  assert.deepEqual(refunds.rows, [{ order_id: null, refund_status: 'pending' }]);
  assert.equal((await facts.readProductFacts(store, [product]))[0].available, 1);
  console.log('Verified payment amount, concurrent replay, atomic order and late-capture refund in PostgreSQL.');
} finally {
  await pool.end();
}
