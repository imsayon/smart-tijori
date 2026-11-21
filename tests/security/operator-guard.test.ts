import { describe, it, expect } from 'vitest';
import { verifyOperatorSession } from '@/server/http/auth/operator-guard';
import { HttpError } from '@/server/http/errors/http-errors';

describe('Operator Guard Security Tests', () => {
  it('rejects requests without operator credentials with 401', () => {
    const req = new Request('http://localhost:3000/api/ops/state', {
      method: 'GET',
    });

    expect(() => verifyOperatorSession(req)).toThrowError(HttpError);
    try {
      verifyOperatorSession(req);
    } catch (err) {
      expect((err as HttpError).status).toBe(401);
      expect((err as HttpError).code).toBe('FORBIDDEN');
    }
  });

  it('rejects invalid or tampered operator tokens with 403', () => {
    const req = new Request('http://localhost:3000/api/ops/state', {
      method: 'GET',
      headers: {
        authorization: 'Bearer bad_token_123',
      },
    });

    expect(() => verifyOperatorSession(req)).toThrowError(HttpError);
    try {
      verifyOperatorSession(req);
    } catch (err) {
      expect((err as HttpError).status).toBe(403);
    }
  });

  it('accepts valid operator bearer token and extracts actor identity', () => {
    const req = new Request('http://localhost:3000/api/ops/state', {
      method: 'GET',
      headers: {
        authorization: 'Bearer ops_staff01_blr-01',
      },
    });

    const actor = verifyOperatorSession(req);
    expect(actor.operatorId).toBe('staff01');
    expect(actor.storeId).toBe('blr-01');
    expect(actor.role).toBe('store_operator');
  });

  it('accepts valid operator cookie', () => {
    const req = new Request('http://localhost:3000/api/ops/state', {
      method: 'GET',
      headers: {
        cookie: 'st_ops_session=ops_staff02_mys-01; Path=/',
      },
    });

    const actor = verifyOperatorSession(req);
    expect(actor.operatorId).toBe('staff02');
    expect(actor.storeId).toBe('mys-01');
  });

  it('ignores body-supplied customer/operator IDs to prevent privilege escalation', () => {
    // Even if client sends malicious body { operatorId: 'admin', role: 'root' },
    // verifyOperatorSession only parses server-issued credentials
    const req = new Request('http://localhost:3000/api/ops/state', {
      method: 'POST',
      body: JSON.stringify({ operatorId: 'fake-admin', role: 'superuser' }),
    });

    expect(() => verifyOperatorSession(req)).toThrowError(HttpError);
  });
});
