import { describe, it, expect } from 'vitest';
import { parseBoundedJson } from '@/server/http/security/payload-bounds';
import { HttpError } from '@/server/http/errors/http-errors';
import { updateCartSchema } from '@/server/http/validation/schemas';

describe('Payload Bounds & Request Validation Security Tests', () => {
  it('accepts valid small JSON payloads within 64KB bound', async () => {
    const payload = { storeId: 'blr-01', lines: [] };
    const req = new Request('http://localhost:3000/api/cart', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const parsed = await parseBoundedJson(req);
    expect(parsed).toEqual(payload);
  });

  it('rejects oversized bodies exceeding byte limit with VALIDATION_ERROR', async () => {
    const largeObject = {
      storeId: 'blr-01',
      junk: 'x'.repeat(70 * 1024), // 70 KB > 64 KB
    };

    const req = new Request('http://localhost:3000/api/cart', {
      method: 'PUT',
      body: JSON.stringify(largeObject),
    });

    await expect(parseBoundedJson(req, 64 * 1024)).rejects.toThrowError(HttpError);
    try {
      await parseBoundedJson(req, 64 * 1024);
    } catch (err) {
      expect((err as HttpError).code).toBe('VALIDATION_ERROR');
      expect((err as HttpError).status).toBe(400);
    }
  });

  it('rejects malformed JSON payloads gracefully without 500 crashes', async () => {
    const req = new Request('http://localhost:3000/api/cart', {
      method: 'PUT',
      body: '{ storeId: "broken-json, ',
    });

    await expect(parseBoundedJson(req)).rejects.toThrowError(HttpError);
  });

  it('validates schema bounds: rejects negative quantities or excessive lines', () => {
    const negativeQty = {
      storeId: 'blr-01',
      lines: [{ productId: 'blr-basmati-1kg', quantity: -1 }],
    };
    expect(updateCartSchema.safeParse(negativeQty).success).toBe(false);

    const excessiveLines = {
      storeId: 'blr-01',
      lines: Array.from({ length: 60 }).map((_, i) => ({
        productId: `p-${i}`,
        quantity: 1,
      })),
    };
    expect(updateCartSchema.safeParse(excessiveLines).success).toBe(false);
  });
});
