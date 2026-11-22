import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/shop-assistant/route';

function request(turns: unknown, extraHeaders: Record<string, string> = {}) {
  return new Request('https://shop.example/api/shop-assistant', {
    method: 'POST',
    headers: { host: 'shop.example', origin: 'https://shop.example', 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ turns }),
  });
}

const question = [{ role: 'user', text: 'Where do I track an order?' }];
afterEach(() => vi.unstubAllGlobals());

describe('shop assistant', () => {
  it('rejects cross-site requests and invalid turns before calling the provider', async () => {
    expect((await POST(request(question, { origin: 'https://other.example' }))).status).toBe(403);
    expect((await POST(request([{ role: 'model', text: 'Invalid first turn' }]))).status).toBe(400);
  });

  it('returns only assistant text and limits requests for the same browser session', async () => {
    const oldKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';
    const provider = vi.fn(async () => Response.json({ candidates: [{ content: { parts: [
      { thought: true, text: 'internal thought' }, { text: 'Open Orders from the shop menu.' },
    ] } }] }));
    vi.stubGlobal('fetch', provider);
    try {
      const response = await POST(request(question));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ reply: 'Open Orders from the shop menu.' });
      const cookie = response.headers.get('set-cookie')!.split(';')[0];
      for (let i = 0; i < 4; i++) expect((await POST(request(question, { cookie }))).status).toBe(200);
      expect((await POST(request(question, { cookie }))).status).toBe(429);
      expect(provider).toHaveBeenCalledTimes(5);
    } finally {
      if (oldKey !== undefined) process.env.GEMINI_API_KEY = oldKey;
      else delete process.env.GEMINI_API_KEY;
    }
  });
});
