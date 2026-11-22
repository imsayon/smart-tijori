import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findMerchant, readMerchant, requireMerchant } from '@/server/http/auth/merchant';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  readAccount: vi.fn(),
}));

vi.mock('@server/db/runtime', () => ({
  getCommerceDatabase: () => ({
    transact: (run: (client: { query: typeof mocks.query }) => Promise<unknown>) => run({ query: mocks.query }),
  }),
}));
vi.mock('@server/http/auth/firebase-session', () => ({ readAccount: mocks.readAccount }));

describe('Firebase merchant identity and branch authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SMARTTIJORI_DEMO_MODE', 'false');
    mocks.readAccount.mockResolvedValue({ uid: 'firebase-merchant-uid' });
    mocks.query.mockResolvedValue({ rows: [] });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('does not grant a merchant role without an active DB membership', async () => {
    expect(await readMerchant('st_account=session-cookie')).toBeNull();
    expect(mocks.query).toHaveBeenCalledWith(
      'SELECT store_id FROM operator_memberships WHERE firebase_uid = $1 AND active',
      ['firebase-merchant-uid'],
    );
    await expect(requireMerchant(new Request('https://shop.example/api/ops/inventory', {
      headers: { cookie: 'st_account=session-cookie' },
    }))).rejects.toMatchObject({ status: 403 });
  });

  it('authorizes only the store returned by the database, not any body or header', async () => {
    mocks.query.mockResolvedValue({ rows: [{ store_id: 'blr-01' }] });
    const merchant = await requireMerchant(new Request('https://shop.example/api/ops/inventory?storeId=other-store', {
      headers: { cookie: 'st_account=session-cookie', 'x-store-id': 'other-store' },
    }));
    expect(merchant).toEqual({
      operatorId: 'firebase-merchant-uid',
      role: 'store_operator',
      storeId: 'blr-01',
    });
  });

  it('reports a missing SELECT grant as a service problem, not a wrong password', async () => {
    mocks.query.mockRejectedValue({ code: '42501' });
    await expect(findMerchant('firebase-merchant-uid')).rejects.toMatchObject({
      status: 503,
      message: 'Merchant sign-in is temporarily unavailable.',
    });
  });

  it('reports missing migration as unavailable instead of granting fallback access', async () => {
    mocks.query.mockRejectedValue({ code: '42P01' });
    await expect(findMerchant('firebase-merchant-uid')).rejects.toMatchObject({ status: 503 });
  });

  it('does not authorize a missing or revoked Firebase session', async () => {
    mocks.readAccount.mockResolvedValue(null);
    await expect(requireMerchant(new Request('https://shop.example/api/ops/inventory')))
      .rejects.toMatchObject({ status: 403 });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
