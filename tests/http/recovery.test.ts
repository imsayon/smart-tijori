import { describe, it, expect, beforeEach } from 'vitest';
import { handlePostRecovery } from '@/server/http/routes/recovery-handler';
import { setCommerceCommands } from '@/server/http/adapters';
import { RecordingAdapter } from '@/server/http/adapters/recording-adapter';
import { SESSION_COOKIE_NAME } from '@/server/http/sessions/session-manager';
import { HttpError } from '@/server/http/errors/http-errors';
import type { ProductOffer, RecoveryResult } from '@/contracts';

describe('Recovery HTTP Handler Tests (POST /api/recovery)', () => {
  let recordingAdapter: RecordingAdapter;
  const testSession = '11111111-1111-4111-8111-111111111111';

  const unavailableOffer: ProductOffer = {
    productId: 'prod-unavailable',
    storeId: 'blr-01',
    city: 'Bengaluru',
    name: 'Liquid Detergent (Original)',
    category: 'household',
    purpose: 'laundry-detergent',
    pricePaise: 25000, // ₹250
    imageUrl: '/images/detergent.webp',
    pack: { quantity: 1000, unit: 'ml' },
    attributes: { machineWash: 'yes', type: 'front-load' },
    available: 0,
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
  };

  const createCandidate = (
    id: string,
    name: string,
    pricePaise: number,
    packQty: number,
    available: number,
    typeAttr = 'front-load'
  ): ProductOffer => ({
    productId: id,
    storeId: 'blr-01',
    city: 'Bengaluru',
    name,
    category: 'household',
    purpose: 'laundry-detergent',
    pricePaise,
    imageUrl: `/images/${id}.webp`,
    pack: { quantity: packQty, unit: 'ml' },
    attributes: { machineWash: 'yes', type: typeAttr },
    available,
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
  });

  beforeEach(() => {
    recordingAdapter = new RecordingAdapter();
    setCommerceCommands(recordingAdapter);
  });

  const makeRequest = (
    body: unknown,
    headers: Record<string, string> = {},
    rawBodyString?: string
  ) => {
    return new Request('http://localhost:3000/api/recovery', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Content-Type': 'application/json',
        ...headers,
      },
      body: rawBodyString !== undefined ? rawBodyString : JSON.stringify(body),
    });
  };

  it('handles valid recovery request and records adapter call with trusted session', async () => {
    const candidate1 = createCandidate('cand-01', 'Eco Detergent 1L', 20000, 1000, 15);
    recordingAdapter.setFixture('getProductOffers', [unavailableOffer, candidate1]);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-unavailable',
      text: 'Need front-load detergent',
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    const result: RecoveryResult = await res.json();
    expect(result.mode).toBe('rules'); // No model invocation in this standalone adapter.
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].offer.productId).toBe('cand-01');

    // Verify adapter call was recorded with storeId
    const calls = recordingAdapter.callsFor('getProductOffers');
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe('blr-01');
  });

  it('bounds alternatives to a maximum of three candidates', async () => {
    const candidates = [
      unavailableOffer,
      createCandidate('c-1', 'Alt Detergent 1', 24000, 1000, 10),
      createCandidate('c-2', 'Alt Detergent 2', 23000, 1000, 10),
      createCandidate('c-3', 'Alt Detergent 3', 22000, 1000, 10),
      createCandidate('c-4', 'Alt Detergent 4', 21000, 1000, 10),
      createCandidate('c-5', 'Alt Detergent 5', 20000, 1000, 10),
    ];
    recordingAdapter.setFixture('getProductOffers', candidates);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-unavailable',
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    const result: RecoveryResult = await res.json();
    expect(result.candidates.length).toBeLessThanOrEqual(3);
    expect(result.candidates).toHaveLength(3);
  });

  it('strictly excludes candidates with zero or negative stock', async () => {
    const zeroStock = createCandidate('cand-zero', 'Zero Stock Detergent', 21000, 1000, 0);
    const negativeStock = createCandidate('cand-neg', 'Negative Stock Detergent', 22000, 1000, -2);
    const inStock = createCandidate('cand-available', 'Available Detergent', 23000, 1000, 5);

    recordingAdapter.setFixture('getProductOffers', [
      unavailableOffer,
      zeroStock,
      negativeStock,
      inStock,
    ]);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-unavailable',
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    const result: RecoveryResult = await res.json();
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].offer.productId).toBe('cand-available');
    expect(result.candidates[0].offer.available).toBe(5);
  });

  it('generates accurate factual price and package comparison reasons', async () => {
    // cand-savings: ₹200 vs original ₹250 (savings = ₹50), identical pack (1000 ml)
    const candSavings = createCandidate('cand-savings', 'Cheaper Detergent', 20000, 1000, 12);
    // cand-larger: ₹250 vs original ₹250 (same price), larger pack (1500 ml)
    const candLarger = createCandidate('cand-larger', 'Larger Detergent', 25000, 1500, 8);

    recordingAdapter.setFixture('getProductOffers', [
      unavailableOffer,
      candSavings,
      candLarger,
    ]);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-unavailable',
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    const result: RecoveryResult = await res.json();
    const savingsResult = result.candidates.find((c) => c.offer.productId === 'cand-savings');
    expect(savingsResult).toBeDefined();
    expect(savingsResult!.reasons).toContain('₹50 lower price than original item');
    expect(savingsResult!.reasons).toContain('Identical pack size (1000 ml)');
    expect(savingsResult!.reasons).toContain('Matches front-load specification');
    expect(savingsResult!.reasons).toContain('Currently in stock at Bengaluru branch (12 available)');

    const largerResult = result.candidates.find((c) => c.offer.productId === 'cand-larger');
    expect(largerResult).toBeDefined();
    expect(largerResult!.reasons).toContain('Same price as original item');
    expect(largerResult!.reasons).toContain('Larger pack size (1500 ml)');
    expect(largerResult!.reasons).toContain('Currently in stock at Bengaluru branch (8 available)');
  });

  it('rejects invalid or missing request fields with 400 VALIDATION_ERROR', async () => {
    // Missing storeId
    const req1 = makeRequest({ unavailableProductId: 'prod-unavailable' });
    const res1 = await handlePostRecovery(req1);
    expect(res1.status).toBe(400);
    const body1 = await res1.json();
    expect(body1.error.code).toBe('VALIDATION_ERROR');

    // Missing unavailableProductId
    const req2 = makeRequest({ storeId: 'blr-01' });
    const res2 = await handlePostRecovery(req2);
    expect(res2.status).toBe(400);
    const body2 = await res2.json();
    expect(body2.error.code).toBe('VALIDATION_ERROR');

    // Negative maxPricePaise in explicit constraints
    const req3 = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-unavailable',
      explicitConstraints: { maxPricePaise: -500 },
    });
    const res3 = await handlePostRecovery(req3);
    expect(res3.status).toBe(400);
    const body3 = await res3.json();
    expect(body3.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects oversized request bodies (> 64 KB) with 400 VALIDATION_ERROR', async () => {
    const hugePadding = 'x'.repeat(70 * 1024); // 70 KB
    const req = makeRequest(
      null,
      {},
      JSON.stringify({
        storeId: 'blr-01',
        unavailableProductId: 'prod-unavailable',
        text: hugePadding,
      })
    );

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/exceeds maximum allowed size/i);
  });

  it('enforces mutation origin / CSRF check and rejects cross-origin requests', async () => {
    const req = makeRequest(
      {
        storeId: 'blr-01',
        unavailableProductId: 'prod-unavailable',
      },
      {
        origin: 'http://malicious-site.com',
        host: 'localhost:3000',
        // Omitting sec-fetch-site or setting cross-site
        'sec-fetch-site': 'cross-site',
      }
    );

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('handles dependency failure gracefully without leaking internal stack traces', async () => {
    // Custom recording adapter subclass that throws an internal error
    const failingAdapter = new RecordingAdapter({
      ...recordingAdapter,
      async getProductOffers() {
        throw new Error('PostgreSQL / OpenSearch internal connection pool exhausted: secret_db_pw');
      },
    } as unknown as typeof recordingAdapter);

    setCommerceCommands(failingAdapter);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-unavailable',
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    // Generic message must NOT leak internal error text or credentials
    expect(body.error.message).toBe('An unexpected service error occurred. Please try again.');
    expect(JSON.stringify(body)).not.toContain('secret_db_pw');
    expect(JSON.stringify(body)).not.toContain('connection pool exhausted');
  });

  it('maps explicit HttpError dependency unavailable to status 503', async () => {
    const failingAdapter = new RecordingAdapter({
      ...recordingAdapter,
      async getProductOffers() {
        throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Recovery service temporarily unavailable', 503);
      },
    } as unknown as typeof recordingAdapter);

    setCommerceCommands(failingAdapter);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-unavailable',
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(body.error.message).toBe('Recovery service temporarily unavailable');
  });

  it('guarantees no invented stock or product facts in candidate output', async () => {
    const realCandidate = createCandidate('cand-real', 'Actual In-Stock Detergent', 19900, 1000, 7);
    recordingAdapter.setFixture('getProductOffers', [unavailableOffer, realCandidate]);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-unavailable',
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    const result: RecoveryResult = await res.json();
    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0].offer;

    // Verify all returned candidate facts strictly match the real offer
    expect(candidate.productId).toBe(realCandidate.productId);
    expect(candidate.name).toBe(realCandidate.name);
    expect(candidate.pricePaise).toBe(realCandidate.pricePaise);
    expect(candidate.available).toBe(realCandidate.available);
    expect(candidate.pack).toEqual(realCandidate.pack);
    expect(candidate.storeId).toBe(realCandidate.storeId);
  });

  it('correctly handles guest shopper session and sets cookie when session is new', async () => {
    recordingAdapter.setFixture('getProductOffers', [unavailableOffer]);

    // Request WITHOUT existing session cookie
    const req = new Request('http://localhost:3000/api/recovery', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        unavailableProductId: 'prod-unavailable',
      }),
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    // Should issue fresh session cookie
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
  });
});
