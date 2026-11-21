import { describe, it, expect, beforeEach } from 'vitest';
import { handlePostInterest } from '@/server/http/routes/interest-handler';
import { handlePostRecovery } from '@/server/http/routes/recovery-handler';
import { setCommerceCommands } from '@/server/http/adapters';
import { FixtureCommerceAdapter } from '@/server/http/adapters/fixture-commerce-adapter';
import { SESSION_COOKIE_NAME } from '@/server/http/sessions/session-manager';

describe('Interest and Recovery HTTP Handlers Tests', () => {
  let adapter: FixtureCommerceAdapter;
  const testSession = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    adapter = new FixtureCommerceAdapter();
    setCommerceCommands(adapter);
  });

  it('POST /api/interest saves stock demand intent and returns saved: true', async () => {
    const req = new Request('http://localhost:3000/api/interest', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        productId: 'blr-detergent-liquid-1l',
      }),
    });

    const res = await handlePostInterest(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.saved).toBe(true);
  });

  it('POST /api/recovery returns at most 3 factual alternatives in the same store', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const req = new Request('http://localhost:3000/api/recovery', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${testSession}`,
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId: 'blr-01',
          unavailableProductId: 'blr-detergent-liquid-1l',
          text: 'Need laundry detergent under ₹300',
        }),
      });

      const res = await handlePostRecovery(req);
      expect(res.status).toBe(200);

      const result = await res.json();
      expect(result.mode).toBe('rules'); // No model was invoked by the standalone adapter.
      expect(result.candidates.length).toBeLessThanOrEqual(3);
      for (const cand of result.candidates) {
        expect(cand.offer.productId).not.toBe('blr-detergent-liquid-1l');
        expect(cand.offer.storeId).toBe('blr-01');
        expect(cand.reasons.length).toBeGreaterThan(0);
      }
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
