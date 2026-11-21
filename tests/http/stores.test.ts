import { describe, it, expect, beforeEach } from 'vitest';
import { handleGetStores } from '@/server/http/routes/stores-handler';
import { handleGetProducts } from '@/server/http/routes/products-handler';
import { setCommerceCommands } from '@/server/http/adapters';
import { FixtureCommerceAdapter } from '@/server/http/adapters/fixture-commerce-adapter';
import { SESSION_COOKIE_NAME } from '@/server/http/sessions/session-manager';

describe('Stores & Products HTTP Handlers Tests', () => {
  let adapter: FixtureCommerceAdapter;

  beforeEach(() => {
    adapter = new FixtureCommerceAdapter();
    setCommerceCommands(adapter);
  });

  it('GET /api/stores returns Bengaluru and Mysuru branches and issues guest session', async () => {
    const req = new Request('http://localhost:3000/api/stores', {
      method: 'GET',
    });

    const res = await handleGetStores(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.stores.length).toBeGreaterThanOrEqual(2);
    const storeIds = data.stores.map((s: { id: string }) => s.id);
    expect(storeIds).toContain('blr-01');
    expect(storeIds).toContain('mys-01');

    // Verifies Set-Cookie is issued for a new visitor
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
  });

  it('GET /api/products returns branch-aware products filtered by category', async () => {
    const req = new Request('http://localhost:3000/api/products?storeId=blr-01&category=pantry', {
      method: 'GET',
    });

    const res = await handleGetProducts(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((p: { category: string }) => p.category === 'pantry')).toBe(true);
    expect(data.items.every((p: { storeId: string }) => p.storeId === 'blr-01')).toBe(true);
  });

  it('GET /api/products caps items at maximum 24 per contract', async () => {
    const req = new Request('http://localhost:3000/api/products?storeId=blr-01', {
      method: 'GET',
    });

    const res = await handleGetProducts(req);
    const data = await res.json();
    expect(data.items.length).toBeLessThanOrEqual(24);
  });
});
