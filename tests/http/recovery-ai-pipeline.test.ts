import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handlePostRecovery } from '@/server/http/routes/recovery-handler';
import { setCommerceCommands } from '@/server/http/adapters';
import { RecordingAdapter } from '@/server/http/adapters/recording-adapter';
import { SESSION_COOKIE_NAME } from '@/server/http/sessions/session-manager';
import type { ProductOffer, RecoveryResult } from '@/contracts';
import * as geminiAdapterModule from '../../ai/gemini-adapter';
import { GeminiModelAdapter } from '../../ai/gemini-adapter';
import * as retrievalBridgeModule from '../../ai/retrieval-bridge';

describe('Recovery AI Pipeline HTTP Tests (POST /api/recovery)', () => {
  let recordingAdapter: RecordingAdapter;
  const testSession = '22222222-2222-4222-8222-222222222222';

  const unavailableOffer: ProductOffer = {
    productId: 'prod-tea-gold-unavailable',
    storeId: 'blr-01',
    city: 'Bengaluru',
    name: 'Tata Tea Gold Leaf 500g',
    category: 'essentials',
    purpose: 'tea',
    pricePaise: 28000, // ₹280
    imageUrl: '/images/tea-gold.webp',
    pack: { quantity: 500, unit: 'g' },
    attributes: { type: 'leaf-tea', organic: 'false' },
    available: 0, // Out of stock
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
  };

  const createCandidate = (
    id: string,
    name: string,
    pricePaise: number,
    packQty: number,
    packUnit: 'g' | 'kg' | 'ml' | 'l' | 'count',
    available: number,
    typeAttr = 'leaf-tea'
  ): ProductOffer => ({
    productId: id,
    storeId: 'blr-01',
    city: 'Bengaluru',
    name,
    category: 'essentials',
    purpose: 'tea',
    pricePaise,
    imageUrl: `/images/${id}.webp`,
    pack: { quantity: packQty, unit: packUnit as ProductOffer['pack']['unit'] },
    attributes: { type: typeAttr, organic: 'false' },
    available,
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
  });

  beforeEach(() => {
    recordingAdapter = new RecordingAdapter();
    setCommerceCommands(recordingAdapter);
    vi.restoreAllMocks();
  });

  const makeRequest = (
    body: unknown,
    headers: Record<string, string> = {}
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
      body: JSON.stringify(body),
    });
  };

  it('uses AI mode when Gemini adapter successfully extracts intent from text', async () => {
    const candidate = createCandidate('cand-tea-premium', 'Tata Tea Premium 1kg', 42000, 1000, 'g', 15);
    recordingAdapter.setFixture('getProductOffers', [unavailableOffer, candidate]);

    // Mock Gemini adapter
    const mockAdapter = new GeminiModelAdapter({
      apiKey: 'test-key',
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        purpose: 'tea',
                        maxPricePaise: 50000,
                        minPack: { quantity: 500, unit: 'g' },
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        ),
    });

    vi.spyOn(geminiAdapterModule, 'getGeminiAdapter').mockReturnValue(mockAdapter);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-tea-gold-unavailable',
      text: 'I need tea under 500 rupees',
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    const result: RecoveryResult = await res.json();
    expect(result.mode).toBe('ai');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].offer.productId).toBe('cand-tea-premium');
    expect(result.candidates[0].reasons.some((r) => r.includes('Within stated budget'))).toBe(true);
  });

  it('falls back cleanly to labeled rules mode when Gemini provider encounters an error', async () => {
    const candidate = createCandidate('cand-tea-leaf', 'Tata Tea Agni 500g', 18000, 500, 'g', 20);
    recordingAdapter.setFixture('getProductOffers', [unavailableOffer, candidate]);

    // Mock Gemini adapter to fail with quota error
    const failingAdapter = new GeminiModelAdapter({
      apiKey: 'test-key',
      fetchFn: async () => new Response('Quota exceeded', { status: 429 }),
    });

    vi.spyOn(geminiAdapterModule, 'getGeminiAdapter').mockReturnValue(failingAdapter);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-tea-gold-unavailable',
      text: 'Need good tea',
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    const result: RecoveryResult = await res.json();
    expect(result.mode).toBe('rules'); // Clearly labeled rules fallback
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].offer.productId).toBe('cand-tea-leaf');
  });

  it('explicit shopper constraints take priority over conflicting model extraction', async () => {
    const candidateBudget = createCandidate('cand-budget', 'Budget Tea 500g', 20000, 500, 'g', 10);
    const candidateExpensive = createCandidate('cand-expensive', 'Expensive Tea 500g', 45000, 500, 'g', 10);
    recordingAdapter.setFixture('getProductOffers', [unavailableOffer, candidateBudget, candidateExpensive]);

    // Model extracted a generous ₹500 budget (50000 paise)
    const mockAdapter = new GeminiModelAdapter({
      apiKey: 'test-key',
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        purpose: 'tea',
                        maxPricePaise: 50000,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        ),
    });

    vi.spyOn(geminiAdapterModule, 'getGeminiAdapter').mockReturnValue(mockAdapter);

    // Shopper explicitly specifies strict ₹250 budget (25000 paise)
    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-tea-gold-unavailable',
      text: 'Any tea',
      explicitConstraints: {
        maxPricePaise: 25000, // Explicit ₹250
      },
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    const result: RecoveryResult = await res.json();
    expect(result.constraints.maxPricePaise).toBe(25000);

    const candidateIds = result.candidates.map((c) => c.offer.productId);
    expect(candidateIds).toContain('cand-budget'); // ₹200 <= ₹250
    expect(candidateIds).not.toContain('cand-expensive'); // ₹450 > ₹250 (rejected by explicit constraint)
  });

  it('ZeroDeadEnd: returns valid empty candidate list with preserved constraints when no product matches', async () => {
    // Only expensive tea available
    const candidateExpensive = createCandidate('cand-exp', 'Royal Tea 500g', 90000, 500, 'g', 5);
    recordingAdapter.setFixture('getProductOffers', [unavailableOffer, candidateExpensive]);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-tea-gold-unavailable',
      explicitConstraints: {
        maxPricePaise: 20000, // Budget ₹200 (impossible)
      },
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    const result: RecoveryResult = await res.json();
    expect(result.candidates).toEqual([]);
    expect(result.constraints.maxPricePaise).toBe(20000);
  });

  it('propagates real database/search dependency failures as 500/503 DEPENDENCY_UNAVAILABLE', async () => {
    const failingAdapter = new RecordingAdapter({
      ...recordingAdapter,
      async getProductOffers() {
        throw new Error('Aiven PostgreSQL connection pool failed');
      },
    } as unknown as typeof recordingAdapter);

    setCommerceCommands(failingAdapter);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-tea-gold-unavailable',
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(body.error.message).toBe('An unexpected service error occurred. Please try again.');
  });

  it('proves recovery handler delegates retrieval, verification and ranking to the retrieval bridge in both AI and rules modes', async () => {
    const candidate = createCandidate('cand-tea-leaf', 'Tata Tea Agni 500g', 18000, 500, 'g', 20);
    recordingAdapter.setFixture('getProductOffers', [unavailableOffer, candidate]);

    const bridgeSpy = vi.spyOn(retrievalBridgeModule, 'findCandidatesFromShopperQuery');

    // 1. Rules mode request (no text)
    const rulesReq = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-tea-gold-unavailable',
    });
    const rulesRes = await handlePostRecovery(rulesReq);
    expect(rulesRes.status).toBe(200);
    expect(bridgeSpy).toHaveBeenCalledTimes(1);
    expect(bridgeSpy).toHaveBeenLastCalledWith(
      '',
      expect.objectContaining({
        storeId: 'blr-01',
        allowRulesFallback: true,
      })
    );
    const rulesJson: RecoveryResult = await rulesRes.json();
    expect(rulesJson.mode).toBe('rules');

    // 2. AI mode request (with text)
    const mockAdapter = new GeminiModelAdapter({
      apiKey: 'test-key',
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        purpose: 'tea',
                        maxPricePaise: 50000,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        ),
    });
    vi.spyOn(geminiAdapterModule, 'getGeminiAdapter').mockReturnValue(mockAdapter);

    const aiReq = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-tea-gold-unavailable',
      text: 'Need good tea',
    });
    const aiRes = await handlePostRecovery(aiReq);
    expect(aiRes.status).toBe(200);
    expect(bridgeSpy).toHaveBeenCalledTimes(2);
    expect(bridgeSpy).toHaveBeenLastCalledWith(
      'Need good tea',
      expect.objectContaining({
        storeId: 'blr-01',
        allowRulesFallback: true,
      })
    );
    const aiJson: RecoveryResult = await aiRes.json();
    expect(aiJson.mode).toBe('ai');
  });

  it('enforces unit compatibility across unit scales (1 kg satisfies 500 g min pack)', async () => {
    // 1kg = 1000g >= 500g (compatible!)
    const candidateKg = createCandidate('cand-1kg', 'Tata Tea Premium 1kg', 35000, 1, 'kg', 10);
    // 200g < 500g (too small)
    const candidateSmall = createCandidate('cand-200g', 'Tata Tea Small 200g', 10000, 200, 'g', 10);
    recordingAdapter.setFixture('getProductOffers', [unavailableOffer, candidateKg, candidateSmall]);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-tea-gold-unavailable',
      explicitConstraints: {
        minPack: { quantity: 500, unit: 'g' },
      },
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    const result: RecoveryResult = await res.json();
    const candidateIds = result.candidates.map((c) => c.offer.productId);
    expect(candidateIds).toContain('cand-1kg');
    expect(candidateIds).not.toContain('cand-200g');
  });

  it('strictly provides suggestions only and never mutates cart or reserves stock automatically', async () => {
    const candidate = createCandidate('cand-tea-leaf', 'Tata Tea Agni 500g', 18000, 500, 'g', 20);
    recordingAdapter.setFixture('getProductOffers', [unavailableOffer, candidate]);

    const req = makeRequest({
      storeId: 'blr-01',
      unavailableProductId: 'prod-tea-gold-unavailable',
    });

    const res = await handlePostRecovery(req);
    expect(res.status).toBe(200);

    // Assert that no cart mutation or hold creation commands were called on the adapter
    expect(recordingAdapter.callsFor('updateCart')).toHaveLength(0);
    expect(recordingAdapter.callsFor('createHold')).toHaveLength(0);
    expect(recordingAdapter.callsFor('confirmOrder')).toHaveLength(0);
  });
});
