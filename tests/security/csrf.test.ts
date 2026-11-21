import { describe, it, expect } from 'vitest';
import { validateMutationOrigin } from '@/server/http/security/csrf';
import { HttpError } from '@/server/http/errors/http-errors';

describe('CSRF & Mutation Origin Security Tests', () => {
  it('allows safe read-only methods (GET, HEAD)', () => {
    const req = new Request('http://localhost:3000/api/cart', {
      method: 'GET',
    });
    expect(() => validateMutationOrigin(req)).not.toThrow();
  });

  it('rejects cross-site mutations when Sec-Fetch-Site is cross-site', () => {
    const req = new Request('http://localhost:3000/api/cart', {
      method: 'PUT',
      headers: {
        'sec-fetch-site': 'cross-site',
        origin: 'https://malicious-site.com',
      },
    });

    expect(() => validateMutationOrigin(req)).toThrowError(HttpError);
    try {
      validateMutationOrigin(req);
    } catch (err) {
      expect((err as HttpError).code).toBe('FORBIDDEN');
      expect((err as HttpError).status).toBe(403);
    }
  });

  it('rejects mutation when Origin header host does not match Host header', () => {
    const req = new Request('http://shop.example.com/api/cart', {
      method: 'POST',
      headers: {
        origin: 'https://evil.com',
        host: 'shop.example.com',
      },
    });

    expect(() => validateMutationOrigin(req)).toThrowError(HttpError);
  });

  it('accepts matching same-origin mutation requests', () => {
    const req = new Request('http://localhost:3000/api/cart', {
      method: 'PUT',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'sec-fetch-site': 'same-origin',
      },
    });

    expect(() => validateMutationOrigin(req)).not.toThrow();
  });
});
