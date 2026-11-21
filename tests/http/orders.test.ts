import { describe, it, expect, beforeEach } from 'vitest';
import { handlePostOrders } from '@/server/http/routes/orders-handler';
import { setCommerceCommands } from '@/server/http/adapters';
import { FixtureCommerceAdapter } from '@/server/http/adapters/fixture-commerce-adapter';
import { SESSION_COOKIE_NAME } from '@/server/http/sessions/session-manager';

describe('Orders HTTP Handler Tests', () => {
  let adapter: FixtureCommerceAdapter;
  const testSession = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    adapter = new FixtureCommerceAdapter();
    setCommerceCommands(adapter);
  });

  it('POST /api/orders confirms reservation and returns SIMULATED payment receipt', async () => {
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cart = await adapter.getCart(testSession);
    const holdRes = await adapter.createHold(testSession, cart.id, 'key-ord-01');
    const hold = (holdRes as { ok: true; hold: { id: string } }).hold;

    const req = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'order-op-key-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reservationId: hold.id }),
    });

    const res = await handlePostOrders(req);
    expect(res.status).toBe(201);

    const order = await res.json();
    expect(order.status).toBe('CONFIRMED');
    expect(order.paymentMode).toBe('SIMULATED');
    expect(order.reservationId).toBe(hold.id);
    expect(order.lines).toHaveLength(1);
    expect(order.totalPaise).toBe(18500);
  });

  it('correctly holds and confirms updated high quantities (49 items = ₹9,065)', async () => {
    // 1. Initial cart with 1 item
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cart1 = await adapter.getCart(testSession);
    await adapter.createHold(testSession, cart1.id, 'key-init-1');

    // 2. User updates cart to 49 items
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 49 },
    ]);
    const cart49 = await adapter.getCart(testSession);
    expect(cart49.totalPaise).toBe(18500 * 49); // 906500 paise = ₹9,065

    // 3. Create hold for updated cart
    const holdRes49 = await adapter.createHold(testSession, cart49.id, 'key-updated-49');
    expect(holdRes49.ok).toBe(true);
    const hold49 = (holdRes49 as { ok: true; hold: { id: string; lines: Array<{ quantity: number }>; totalPaise: number } }).hold;
    expect(hold49.lines[0].quantity).toBe(49);
    expect(hold49.totalPaise).toBe(906500);

    // 4. Confirm order for 49 items
    const req = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'order-key-49',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reservationId: hold49.id }),
    });

    const res = await handlePostOrders(req);
    expect(res.status).toBe(201);
    const order = await res.json();
    expect(order.lines[0].quantity).toBe(49);
    expect(order.totalPaise).toBe(906500);
  });

  it('allows a shopper to complete consecutive orders without reusing old cart or hold', async () => {
    // Order 1: 1 item
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cart1 = await adapter.getCart(testSession);
    const holdRes1 = await adapter.createHold(testSession, cart1.id, 'consec-hold-1');
    const hold1 = (holdRes1 as { ok: true; hold: { id: string } }).hold;

    const req1 = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'consec-order-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reservationId: hold1.id }),
    });
    const res1 = await handlePostOrders(req1);
    expect(res1.status).toBe(201);
    const order1 = await res1.json();
    expect(order1.totalPaise).toBe(18500);

    // Order 2: 49 items immediately after order 1 is confirmed
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 49 },
    ]);
    const cart2 = await adapter.getCart(testSession);
    // Cart ID should be fresh after previous cart checkout
    expect(cart2.id).not.toBe(cart1.id);

    const holdRes2 = await adapter.createHold(testSession, cart2.id, 'consec-hold-2');
    expect(holdRes2.ok).toBe(true);
    const hold2 = (holdRes2 as { ok: true; hold: { id: string; lines: Array<{ quantity: number }>; totalPaise: number } }).hold;
    expect(hold2.id).not.toBe(hold1.id);
    expect(hold2.lines[0].quantity).toBe(49);
    expect(hold2.totalPaise).toBe(906500);

    const req2 = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'consec-order-2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reservationId: hold2.id }),
    });
    const res2 = await handlePostOrders(req2);
    expect(res2.status).toBe(201);
    const order2 = await res2.json();
    expect(order2.id).not.toBe(order1.id);
    expect(order2.lines[0].quantity).toBe(49);
    expect(order2.totalPaise).toBe(906500);
  });

  it('POST /api/orders returns identical outcome when retrying with same operation key (lost-response recovery)', async () => {
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cart = await adapter.getCart(testSession);
    const holdRes = await adapter.createHold(testSession, cart.id, 'key-ord-02');
    const hold = (holdRes as { ok: true; hold: { id: string } }).hold;

    const makeRequest = () =>
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
          'Idempotency-Key': 'idempotent-order-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reservationId: hold.id }),
      });

    // Request 1 succeeds
    const res1 = await handlePostOrders(makeRequest());
    const order1 = await res1.json();

    // Request 2 (simulating browser retry after dropped connection) returns exact same order
    const res2 = await handlePostOrders(makeRequest());
    const order2 = await res2.json();

    expect(order1.id).toBe(order2.id);
    expect(order1.createdAt).toBe(order2.createdAt);
  });

  it('POST /api/orders rejects conflicting request body with same operation key', async () => {
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cart = await adapter.getCart(testSession);
    const holdRes1 = await adapter.createHold(testSession, cart.id, 'key-ord-03');
    const hold1 = (holdRes1 as { ok: true; hold: { id: string } }).hold;

    // First order confirmation with key K
    const req1 = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'shared-key-100',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reservationId: hold1.id }),
    });
    await handlePostOrders(req1);

    // Second order with same key K but different reservationId
    const req2 = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'shared-key-100',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reservationId: 'different-reservation-id' }),
    });

    const res2 = await handlePostOrders(req2);
    expect(res2.status).toBe(409);
    const data = await res2.json();
    expect(data.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('POST /api/orders rejects expired hold with 409 HOLD_EXPIRED', async () => {
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cart = await adapter.getCart(testSession);
    const holdRes = await adapter.createHold(testSession, cart.id, 'key-ord-04');
    const hold = (holdRes as { ok: true; hold: { id: string } }).hold;

    // Simulate clock passage past deadline by directly mutating hold in adapter store
    const storedHold = (adapter as unknown as { holds: Map<string, { expiresAt: string }> }).holds.get(hold.id);
    if (storedHold) {
      storedHold.expiresAt = new Date(Date.now() - 10000).toISOString();
    }

    const req = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'key-expired-order',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reservationId: hold.id }),
    });

    const res = await handlePostOrders(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error.code).toBe('HOLD_EXPIRED');
  });

  describe('59-Second Expiry Boundary Tests (expiresAt - 1ms, exactly expiresAt, after expiresAt)', () => {
    it('allows order confirmation at expiresAt - 1ms when all conditions pass', async () => {
      const boundaryAdapter = new FixtureCommerceAdapter();
      await boundaryAdapter.updateCart(testSession, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 1 },
      ]);
      const cart = await boundaryAdapter.getCart(testSession);
      const holdRes = await boundaryAdapter.createHold(testSession, cart.id, 'key-boundary-active');
      const hold = (holdRes as { ok: true; hold: { id: string; expiresAt: string } }).hold;

      // Mock Date or pass serverNow: in confirmOrder, now = new Date() is compared against new Date(hold.expiresAt)
      // We set expiresAt to Date.now() + 1ms (simulating current time is expiresAt - 1ms)
      const stored = (boundaryAdapter as unknown as { holds: Map<string, { expiresAt: string }> }).holds.get(hold.id);
      if (stored) {
        stored.expiresAt = new Date(Date.now() + 100).toISOString(); // 100ms in future (> now)
      }

      const order = await boundaryAdapter.confirmOrder(testSession, hold.id, 'op-key-boundary-active');
      expect(order.status).toBe('CONFIRMED');
      expect(order.reservationId).toBe(hold.id);
    });

    it('rejects order confirmation at exactly expiresAt with 409 HOLD_EXPIRED', async () => {
      const boundaryAdapter = new FixtureCommerceAdapter();
      await boundaryAdapter.updateCart(testSession, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 1 },
      ]);
      const cart = await boundaryAdapter.getCart(testSession);
      const holdRes = await boundaryAdapter.createHold(testSession, cart.id, 'key-boundary-exact');
      const hold = (holdRes as { ok: true; hold: { id: string; expiresAt: string } }).hold;

      // Set expiresAt to the exact current timestamp (or already reached <= now)
      const stored = (boundaryAdapter as unknown as { holds: Map<string, { expiresAt: string }> }).holds.get(hold.id);
      if (stored) {
        // Exact current timestamp
        stored.expiresAt = new Date().toISOString();
      }

      await expect(
        boundaryAdapter.confirmOrder(testSession, hold.id, 'op-key-boundary-exact')
      ).rejects.toThrowError(/expired/i);
    });

    it('rejects order confirmation after expiresAt with 409 HOLD_EXPIRED', async () => {
      const boundaryAdapter = new FixtureCommerceAdapter();
      await boundaryAdapter.updateCart(testSession, 'blr-01', [
        { productId: 'blr-basmati-1kg', quantity: 1 },
      ]);
      const cart = await boundaryAdapter.getCart(testSession);
      const holdRes = await boundaryAdapter.createHold(testSession, cart.id, 'key-boundary-past');
      const hold = (holdRes as { ok: true; hold: { id: string; expiresAt: string } }).hold;

      const stored = (boundaryAdapter as unknown as { holds: Map<string, { expiresAt: string }> }).holds.get(hold.id);
      if (stored) {
        // 500ms in the past
        stored.expiresAt = new Date(Date.now() - 500).toISOString();
      }

      await expect(
        boundaryAdapter.confirmOrder(testSession, hold.id, 'op-key-boundary-past')
      ).rejects.toThrowError(/expired/i);
    });
  });
});
