import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getProducts } from '../../client/app/api/products/route';
import { POST as postRecovery } from '../../client/app/api/recovery/route';
import { setCommerceCommands } from '../../server/http/adapters';
import { FixtureCommerceAdapter } from '../../server/http/adapters/fixture-commerce-adapter';

describe('opt-in shopper demo routes', () => {
  const previousMode = process.env.SMARTTIJORI_DEMO_MODE;

  beforeEach(() => {
    process.env.SMARTTIJORI_DEMO_MODE = 'true';
    setCommerceCommands(new FixtureCommerceAdapter());
  });

  afterEach(() => {
    if (previousMode === undefined) {
      delete process.env.SMARTTIJORI_DEMO_MODE;
    } else {
      process.env.SMARTTIJORI_DEMO_MODE = previousMode;
    }
    vi.unstubAllEnvs();
    setCommerceCommands(null);
  });

  it('returns a branch-specific fixture catalog only when explicitly opted in', async () => {
    const response = await getProducts(
      new NextRequest('http://localhost:3000/api/products?storeId=blr-01&category=pantry'),
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((offer: { storeId: string }) => offer.storeId === 'blr-01')).toBe(true);
  });

  it('serves labeled rules-mode recovery for the explicit demo', async () => {
    const response = await postRecovery(
      new Request('http://localhost:3000/api/recovery', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
        body: JSON.stringify({ storeId: 'blr-01', unavailableProductId: 'blr-detergent-liquid-1l' }),
      }),
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.mode).toBe('rules');
    expect(result.candidates.length).toBeLessThanOrEqual(3);
  });

  it('enables the same rule handler with the explicitly selected PostgreSQL catalog', async () => {
    vi.stubEnv('SMARTTIJORI_DEMO_MODE', 'false');
    vi.stubEnv('ST_CATALOG_SOURCE', 'postgres');
    const response = await postRecovery(new Request('http://localhost:3000/api/recovery', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ storeId: 'blr-01', unavailableProductId: 'blr-detergent-liquid-1l' }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: 'rules' });
  });

  it('fails closed for recovery when fixture mode is disabled', async () => {
    delete process.env.SMARTTIJORI_DEMO_MODE;
    vi.stubEnv('ST_CATALOG_SOURCE', undefined);
    const response = await postRecovery(
      new Request('http://localhost:3000/api/recovery', { method: 'POST' }),
    );
    expect(response.status).toBe(503);
    const result = await response.json();
    expect(result.error.code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});
