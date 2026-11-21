import { describe, it, expect, beforeEach } from 'vitest';
import { handleGetReservation, handleDeleteReservation } from '@/server/http/routes/reservations-handler';
import { handleGetOrder } from '@/server/http/routes/orders-handler';
import { setCommerceCommands } from '@/server/http/adapters';
import { FixtureCommerceAdapter } from '@/server/http/adapters/fixture-commerce-adapter';
import { SESSION_COOKIE_NAME } from '@/server/http/sessions/session-manager';

describe('Cross-Session Read & Write Denial Security Tests', () => {
  let adapter: FixtureCommerceAdapter;
  const sessionA = '11111111-1111-4111-8111-111111111111';
  const sessionB = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    adapter = new FixtureCommerceAdapter();
    setCommerceCommands(adapter);
  });

  it('prevents Session B from viewing a reservation created by Session A', async () => {
    // 1. Session A sets up cart and hold
    await adapter.updateCart(sessionA, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cartA = await adapter.getCart(sessionA);
    const holdRes = await adapter.createHold(sessionA, cartA.id, 'key-a-1');
    expect(holdRes.ok).toBe(true);
    const holdA = (holdRes as { ok: true; hold: { id: string } }).hold;

    // 2. Session B attempts to read Session A's hold
    const reqB = new Request(`http://localhost:3000/api/reservations/${holdA.id}`, {
      method: 'GET',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionB}`,
      },
    });

    const res = await handleGetReservation(reqB, holdA.id);
    expect(res.status).toBe(404); // Must return 404 NOT_FOUND rather than leaking existence
    const data = await res.json();
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('prevents Session B from deleting or releasing Session A’s hold', async () => {
    await adapter.updateCart(sessionA, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cartA = await adapter.getCart(sessionA);
    const holdRes = await adapter.createHold(sessionA, cartA.id, 'key-a-2');
    const holdA = (holdRes as { ok: true; hold: { id: string } }).hold;

    // Session B tries to DELETE Session A's hold
    const reqB = new Request(`http://localhost:3000/api/reservations/${holdA.id}`, {
      method: 'DELETE',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionB}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
    });

    const res = await handleDeleteReservation(reqB, holdA.id);
    expect(res.status).toBe(404);
  });

  it('prevents Session B from reading Session A’s confirmed order', async () => {
    await adapter.updateCart(sessionA, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cartA = await adapter.getCart(sessionA);
    const holdRes = await adapter.createHold(sessionA, cartA.id, 'key-a-3');
    const holdA = (holdRes as { ok: true; hold: { id: string } }).hold;
    const orderA = await adapter.confirmOrder(sessionA, holdA.id, 'order-key-a');

    // Session B attempts to view Session A's order
    const reqB = new Request(`http://localhost:3000/api/orders/${orderA.id}`, {
      method: 'GET',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionB}`,
      },
    });

    const res = await handleGetOrder(reqB, orderA.id);
    expect(res.status).toBe(404);
  });
});
