import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/account/session/route';

const mocks = vi.hoisted(() => ({
  authenticateAccount: vi.fn(), registerAccount: vi.fn(), issueAccountSession: vi.fn(),
  revokeAccountSession: vi.fn(), readAccount: vi.fn(), findMerchant: vi.fn(),
}));
vi.mock('@server/http/auth/email-session', () => ({
  ACCOUNT_COOKIE: 'st_account', ACCOUNT_MAX_AGE: 28800,
  authenticateAccount: mocks.authenticateAccount, registerAccount: mocks.registerAccount,
  issueAccountSession: mocks.issueAccountSession, revokeAccountSession: mocks.revokeAccountSession,
  readAccount: mocks.readAccount, shopperId: (id: string) => 'account:' + id,
}));
vi.mock('@server/http/auth/merchant', () => ({ findMerchant: mocks.findMerchant }));
const account = { uid: 'user-1', email: 'shopper@example.test', email_verified: true };
function request(body: Record<string, unknown>, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/account/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Host: 'localhost:3000' },
    body: JSON.stringify(body),
  });
}
const input = { email: account.email, password: 'long-example-password' };

describe('database email/password session exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateAccount.mockResolvedValue(account);
    mocks.registerAccount.mockResolvedValue(account);
    mocks.issueAccountSession.mockResolvedValue('a'.repeat(64));
    mocks.findMerchant.mockResolvedValue(null);
    mocks.readAccount.mockResolvedValue(null);
  });
  it('issues HttpOnly cookie for a shopper', async () => {
    const res = await POST(request(input));
    expect(res.status).toBe(204);
    expect(mocks.authenticateAccount).toHaveBeenCalledWith(input.email, input.password);
    expect(res.headers.get('set-cookie')).toContain('HttpOnly');
    expect(res.headers.get('set-cookie')).toContain('st_account=');
  });
  it('registers with email and password', async () => {
    const res = await POST(request({ ...input, mode: 'register' }));
    expect(res.status).toBe(204);
    expect(mocks.registerAccount).toHaveBeenCalledWith(input.email, input.password);
  });
  it('denies unassigned merchant', async () => {
    const res = await POST(request({ ...input, merchant: true }));
    expect(res.status).toBe(403);
    expect(mocks.issueAccountSession).not.toHaveBeenCalled();
  });
  it('allows assigned merchant', async () => {
    mocks.findMerchant.mockResolvedValue({ operatorId: account.uid, storeId: 'blr-01' });
    expect((await POST(request({ ...input, merchant: true }))).status).toBe(204);
  });
  it('rejects cross-origin requests', async () => {
    expect((await POST(request(input, 'https://untrusted.example'))).status).toBe(403);
    expect(mocks.authenticateAccount).not.toHaveBeenCalled();
  });
  it('rejects invalid credentials without issuing a session', async () => {
    const { HttpError } = await import('@server/http/errors/http-errors');
    mocks.authenticateAccount.mockRejectedValue(new HttpError('FORBIDDEN', 'Incorrect email or password.', 401));
    expect((await POST(request(input))).status).toBe(401);
    expect(mocks.issueAccountSession).not.toHaveBeenCalled();
  });
  it('returns minimal account status', async () => {
    mocks.readAccount.mockResolvedValue(account);
    const res = await GET(new Request('http://localhost:3000/api/account/session'));
    expect(await res.json()).toEqual({ authenticated: true, email: account.email });
  });
  it('revokes the session on sign-out', async () => {
    const res = await DELETE(new Request('http://localhost:3000/api/account/session', {
      method: 'DELETE', headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
    }));
    expect(res.status).toBe(204);
    expect(mocks.revokeAccountSession).toHaveBeenCalledTimes(1);
  });
});
