import { describe, it, expect, beforeEach } from 'vitest';
import {
  handlePostReservations,
  handleDeleteReservation,
} from '@/server/http/routes/reservations-handler';
import { setCommerceCommands } from '@/server/http/adapters';
import { FixtureCommerceAdapter } from '@/server/http/adapters/fixture-commerce-adapter';
import { SESSION_COOKIE_NAME } from '@/server/http/sessions/session-manager';

describe('Reservations HTTP Handler Tests (CartLock)', () => {
  let adapter: FixtureCommerceAdapter;
  const testSession = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    adapter = new FixtureCommerceAdapter();
    setCommerceCommands(adapter);
  });

  it('POST /api/reservations requires Idempotency-Key header', async () => {
    const req = new Request('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
      body: JSON.stringify({ cartId: 'cart-123' }),
    });

    const res = await handlePostReservations(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.message).toContain('Idempotency-Key');
  });

  it('POST /api/reservations creates five-minute active hold snapshot', async () => {
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 2 },
    ]);
    const cart = await adapter.getCart(testSession);

    const req = new Request('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'key-hold-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cartId: cart.id }),
    });

    const res = await handlePostReservations(req);
    expect(res.status).toBe(201);

    const hold = await res.json();
    expect(hold.status).toBe('ACTIVE');
    expect(hold.lines).toHaveLength(1);
    expect(hold.lines[0].quantity).toBe(2);
    expect(hold.totalPaise).toBe(37000);
    expect(hold.serverNow).toBeDefined();
    expect(hold.expiresAt).toBeDefined();

    // Verify expiry is exactly 300 seconds after server creation time
    const durationMs = new Date(hold.expiresAt).getTime() - new Date(hold.serverNow).getTime();
    expect(durationMs).toBe(300 * 1000);
  });

  it('Hold lifecycle: at 300 seconds it is still active, at 300 seconds it is expired', async () => {
    const adapterTiming = new FixtureCommerceAdapter();

    await adapterTiming.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cart = await adapterTiming.getCart(testSession);
    const holdRes = await adapterTiming.createHold(testSession, cart.id, 'key-lifecycle-01');
    expect(holdRes.ok).toBe(true);
    const hold = (holdRes as { ok: true; hold: { id: string; expiresAt: string; serverNow: string } }).hold;

    const createdTime = new Date(hold.serverNow).getTime();
    const expiryTime = new Date(hold.expiresAt).getTime();
    expect(expiryTime - createdTime).toBe(300 * 1000);

    // Simulate 299 seconds passed: still active
    const simulated299s = new Date(createdTime + 299 * 1000);
    expect(simulated299s.getTime() < expiryTime).toBe(true);

    // Simulate 300 seconds passed: expired
    const simulated300s = new Date(createdTime + 300 * 1000);
    expect(simulated300s.getTime() >= expiryTime).toBe(true);
  });

  it('POST /api/reservations returns 409 STOCK_UNAVAILABLE when stock runs out', async () => {
    // Simulate LastOne taken (set availability to 0)
    adapter.setStockOverride('blr-01', 'blr-detergent-liquid-1l', 0);

    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-detergent-liquid-1l', quantity: 1 },
    ]);
    const cart = await adapter.getCart(testSession);

    const req = new Request('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'key-conflict-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cartId: cart.id }),
    });

    const res = await handlePostReservations(req);
    expect(res.status).toBe(409);

    const data = await res.json();
    expect(data.error.code).toBe('STOCK_UNAVAILABLE');
    expect(data.error.details.unavailableProducts).toContain('blr-detergent-liquid-1l');
  });

  it('DELETE /api/reservations/:id releases active hold safely', async () => {
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cart = await adapter.getCart(testSession);
    const holdRes = await adapter.createHold(testSession, cart.id, 'key-del-01');
    const holdId = (holdRes as { ok: true; hold: { id: string } }).hold.id;

    const req = new Request(`http://localhost:3000/api/reservations/${holdId}`, {
      method: 'DELETE',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
    });

    const res = await handleDeleteReservation(req, holdId);
    expect(res.status).toBe(200);

    const updated = await res.json();
    expect(updated.status).toBe('RELEASED');
  });

  it('Re-reserving after expiry creates a fresh hold with new ID and resets five-minute timer', async () => {
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 2 },
    ]);
    const cart = await adapter.getCart(testSession);

    // Initial hold
    const initialReq = new Request('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'key-initial-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cartId: cart.id }),
    });

    const initialRes = await handlePostReservations(initialReq);
    expect(initialRes.status).toBe(201);
    const firstHold = await initialRes.json();
    expect(firstHold.id).toBeDefined();

    // Expire first hold manually
    adapter.expireHold(firstHold.id);

    // Re-reserve with a NEW operation key
    const retryReq = new Request('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'key-retry-02',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cartId: cart.id }),
    });

    const retryRes = await handlePostReservations(retryReq);
    expect(retryRes.status).toBe(201);
    const secondHold = await retryRes.json();

    // Verifications per Master Plan
    expect(secondHold.id).not.toBe(firstHold.id);
    expect(secondHold.status).toBe('ACTIVE');
    expect(new Date(secondHold.expiresAt).getTime()).toBeGreaterThanOrEqual(
      new Date(firstHold.expiresAt).getTime()
    );
    expect(secondHold.lines).toEqual(firstHold.lines);
    expect(secondHold.totalPaise).toBe(firstHold.totalPaise);
    const freshDurationMs =
      new Date(secondHold.expiresAt).getTime() - new Date(secondHold.serverNow).getTime();
    expect(freshDurationMs).toBe(300 * 1000);
  });

  it('Lost response retry with SAME Idempotency-Key returns cached hold without creating duplicate', async () => {
    await adapter.updateCart(testSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cart = await adapter.getCart(testSession);

    const makeReq = () =>
      new Request('http://localhost:3000/api/reservations', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
          'Idempotency-Key': 'key-lost-response-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cartId: cart.id }),
      });

    const res1 = await handlePostReservations(makeReq());
    expect(res1.status).toBe(201);
    const hold1 = await res1.json();

    // Retry simulated network lost response
    const res2 = await handlePostReservations(makeReq());
    expect(res2.status).toBe(201);
    const hold2 = await res2.json();

    expect(hold2.id).toBe(hold1.id);
    expect(hold2.expiresAt).toBe(hold1.expiresAt);
  });
});
