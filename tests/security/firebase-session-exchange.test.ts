import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/account/session/route';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(),
  readAccount: vi.fn(),
  findMerchant: vi.fn(),
}));

vi.mock('@server/http/auth/firebase-session', () => ({
  ACCOUNT_COOKIE: 'st_account',
  ACCOUNT_MAX_AGE: 28800,
  firebaseAuth: () => ({
    verifyIdToken: mocks.verifyIdToken,
    createSessionCookie: mocks.createSessionCookie,
  }),
  shopperId: (uid: string) => 'firebase:' + uid,
  readAccount: mocks.readAccount,
}));
vi.mock('@server/http/auth/merchant', () => ({ findMerchant: mocks.findMerchant }));

function signIn(body: Record<string, unknown>, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/account/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      Host: 'localhost:3000',
    },
    body: JSON.stringify(body),
  });
}

const verified = () => ({
  uid: 'shopper-1',
  email: 'shopper@example.test',
  email_verified: true,
  auth_time: Math.floor(Date.now() / 1000),
});

describe('Firebase session exchange and role boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyIdToken.mockResolvedValue(verified());
    mocks.createSessionCookie.mockResolvedValue('signed-firebase-session');
    mocks.findMerchant.mockResolvedValue(null);
    mocks.readAccount.mockResolvedValue(null);
  });

  it('creates an HttpOnly same-origin account cookie for a verified shopper', async () => {
    const res = await POST(signIn({ token: 'fresh-id-token' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('set-cookie')).toContain('st_account=signed-firebase-session');
    expect(res.headers.get('set-cookie')).toContain('HttpOnly');
    expect(res.headers.get('set-cookie')?.toLowerCase()).toContain('samesite=lax');
    expect(mocks.verifyIdToken).toHaveBeenCalledWith('fresh-id-token', true);
    expect(mocks.createSessionCookie).toHaveBeenCalledWith('fresh-id-token', { expiresIn: 28800000 });
    expect(mocks.findMerchant).not.toHaveBeenCalled();
  });

  it('rejects unverified email without creating a session', async () => {
    mocks.verifyIdToken.mockResolvedValue({ ...verified(), email_verified: false });
    const res = await POST(signIn({ token: 'fresh-id-token' }));
    expect(res.status).toBe(401);
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
  });

  it('rejects stale or implausibly future auth_time', async () => {
    for (const auth_time of [Math.floor(Date.now() / 1000) - 600, Math.floor(Date.now() / 1000) + 180]) {
      mocks.verifyIdToken.mockResolvedValueOnce({ ...verified(), auth_time });
      const res = await POST(signIn({ token: 'stale-id-token' }));
      expect(res.status).toBe(401);
    }
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
  });

  it('rejects revoked or expired credentials as 401', async () => {
    mocks.verifyIdToken.mockRejectedValueOnce({ code: 'auth/id-token-expired' });
    const res = await POST(signIn({ token: 'expired-token' }));
    expect(res.status).toBe(401);
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
  });

  it('reports unavailable identity provider as 503 instead of invalid password', async () => {
    mocks.verifyIdToken.mockRejectedValueOnce({ code: 'app/invalid-credential' });
    const res = await POST(signIn({ token: 'token' }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
  });

  it('prevents unassigned shoppers from requesting a merchant session', async () => {
    const res = await POST(signIn({ token: 'token', merchant: true }));
    expect(res.status).toBe(403);
    expect(mocks.findMerchant).toHaveBeenCalledWith('shopper-1');
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
  });

  it('allows a verified merchant only after an active database membership lookup', async () => {
    mocks.findMerchant.mockResolvedValueOnce({ operatorId: 'shopper-1', role: 'store_operator', storeId: 'blr-01' });
    const res = await POST(signIn({ token: 'token', merchant: true }));
    expect(res.status).toBe(204);
    expect(mocks.createSessionCookie).toHaveBeenCalledTimes(1);
  });

  it('rejects cross-origin mutation before token verification', async () => {
    const res = await POST(signIn({ token: 'token' }, 'https://untrusted.example'));
    expect(res.status).toBe(403);
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it('provides minimal session status without exposing private credentials or a UID', async () => {
    mocks.readAccount.mockResolvedValueOnce({ email: 'shopper@example.test', uid: 'shopper-1', email_verified: true });
    const res = await GET(new Request('http://localhost:3000/api/account/session', {
      headers: { cookie: 'st_account=session' },
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: true, email: 'shopper@example.test' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('clears the authenticated session and issues a new anonymous session', async () => {
    const res = await DELETE(new Request('http://localhost:3000/api/account/session', {
      method: 'DELETE', headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
    }));
    expect(res.status).toBe(204);
    const cookies = res.headers.getSetCookie().join('; ');
    expect(cookies).toContain('st_account=');
    expect(cookies).toContain('st_session=');
    expect(cookies).toContain('Max-Age=0');
  });
});
