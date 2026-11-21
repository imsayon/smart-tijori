import { describe, it, expect, beforeEach } from 'vitest';
import { handleGetCart, handlePutCart } from '@/server/http/routes/cart-handler';
import { setCommerceCommands } from '@/server/http/adapters';
import { FixtureCommerceAdapter } from '@/server/http/adapters/fixture-commerce-adapter';
import { RecordingAdapter } from '@/server/http/adapters/recording-adapter';
import { SESSION_COOKIE_NAME } from '@/server/http/sessions/session-manager';

describe('Cart HTTP Handler Tests', () => {
  let fixtureAdapter: FixtureCommerceAdapter;
  const testSession = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    fixtureAdapter = new FixtureCommerceAdapter();
    setCommerceCommands(fixtureAdapter);
  });

  it('GET /api/cart returns initialized empty cart for new session', async () => {
    const req = new Request('http://localhost:3000/api/cart', {
      method: 'GET',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
      },
    });

    const res = await handleGetCart(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.sessionId).toBe(testSession);
    expect(data.lines).toHaveLength(0);
    expect(data.totalPaise).toBe(0);
  });

  it('PUT /api/cart computes server-authoritative prices and lines', async () => {
    const req = new Request('http://localhost:3000/api/cart', {
      method: 'PUT',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        lines: [
          { productId: 'blr-basmati-1kg', quantity: 2 }, // 18500 * 2 = 37000
          { productId: 'blr-toor-dal-1kg', quantity: 1 }, // 16000 * 1 = 16000
        ],
      }),
    });

    const res = await handlePutCart(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.storeId).toBe('blr-01');
    expect(data.lines).toHaveLength(2);
    // 37000 + 16000 = 53000 paise (₹530.00)
    expect(data.totalPaise).toBe(53000);
  });

  it('PUT /api/cart with recording adapter records invocations for testing', async () => {
    const recording = new RecordingAdapter(fixtureAdapter);
    setCommerceCommands(recording);

    const req = new Request('http://localhost:3000/api/cart', {
      method: 'PUT',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        lines: [{ productId: 'blr-basmati-1kg', quantity: 1 }],
      }),
    });

    await handlePutCart(req);

    const calls = recording.callsFor('updateCart');
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe(testSession);
    expect(calls[0].args[1]).toBe('blr-01');
  });

  it('PUT /api/cart rejects invalid product IDs with 400 VALIDATION_ERROR', async () => {
    const req = new Request('http://localhost:3000/api/cart', {
      method: 'PUT',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        lines: [{ productId: 'non-existent-product-id', quantity: 1 }],
      }),
    });

    const res = await handlePutCart(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});
