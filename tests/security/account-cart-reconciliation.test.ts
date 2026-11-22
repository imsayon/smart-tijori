import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/account/session/route';

const guestId = '11111111-1111-4111-8111-111111111111';
const accountCartId = '22222222-2222-4222-8222-222222222222';
const guestCartId = '33333333-3333-4333-8333-333333333333';
const query = vi.fn();

vi.mock('@server/db/runtime', () => ({
  getCommerceDatabase: () => ({
    transact: (fn: (client: { query: typeof query }) => Promise<unknown>) => fn({ query }),
  }),
}));
vi.mock('@server/http/auth/email-session', () => ({
  ACCOUNT_COOKIE: 'st_account',
  ACCOUNT_MAX_AGE: 28800,
  shopperId: (uid: string) => 'account:' + uid,
  authenticateAccount: vi.fn().mockResolvedValue({ uid: 'test-user', email: 'a@example.test', email_verified: true }),
  registerAccount: vi.fn().mockResolvedValue({ uid: 'test-user', email: 'a@example.test', email_verified: true }),
  issueAccountSession: vi.fn().mockResolvedValue('a'.repeat(64)),
  readAccount: vi.fn(),
  revokeAccountSession: vi.fn(),
}));
vi.mock('@server/http/auth/merchant', () => ({ findMerchant: vi.fn().mockResolvedValue(null) }));
vi.mock('@server/http/sessions/session-manager', () => ({
  resolveSession: () => ({ sessionId: guestId, isNew: false }),
  buildSessionCookieHeader: () => 'st_session=guest',
}));

const request = (extra: Record<string, unknown> = {}) => new Request('http://localhost:3000/api/account/session', {
  method: 'POST',
  headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'a@example.test', password: 'minimum-length-password', ...extra }),
});

describe('existing guest cart reconciliation on account sign-in', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, owner_id, store_id FROM carts')) return {
        rows: [
          { id: guestCartId, owner_id: guestId, store_id: 'blr-01' },
          { id: accountCartId, owner_id: 'account:test-user', store_id: null },
        ],
      };
      if (sql.includes('SELECT cart_id, quantity FROM cart_lines')) {
        return { rows: [{ cart_id: guestCartId, quantity: 2 }] };
      }
      if (sql.includes('SELECT 1 FROM reservations')) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    });
  });

  it('moves a guest bag using only permitted INSERT and DELETE statements', async () => {
    const response = await POST(request());
    expect(response.status).toBe(204);
    const sql = query.mock.calls.map(call => call[0] as string);
    expect(sql.some(statement => /UPDATE\s+cart_lines/i.test(statement))).toBe(false);
    const copy = sql.findIndex(statement => statement.startsWith('INSERT INTO cart_lines'));
    const removeGuest = sql.findLastIndex(statement => statement === 'DELETE FROM cart_lines WHERE cart_id = $1');
    expect(copy).toBeGreaterThan(-1);
    expect(removeGuest).toBeGreaterThan(copy);
    expect(query.mock.calls[copy][1]).toEqual([guestCartId, accountCartId]);
  });

  it('asks for bag preference when guest and account both contain items', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, owner_id, store_id FROM carts')) return {
        rows: [
          { id: guestCartId, owner_id: guestId, store_id: 'blr-01' },
          { id: accountCartId, owner_id: 'account:test-user', store_id: 'blr-02' },
        ],
      };
      if (sql.includes('SELECT cart_id, quantity FROM cart_lines')) return {
        rows: [{ cart_id: guestCartId, quantity: 2 }, { cart_id: accountCartId, quantity: 3 }],
      };
      if (sql.includes('SELECT 1 FROM reservations')) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).bags).toMatchObject({
      guest: { branch: 'blr-01', quantity: 2 },
      account: { branch: 'blr-02', quantity: 3 },
    });
    expect(query.mock.calls.some(call => (call[0] as string).startsWith('INSERT INTO cart_lines'))).toBe(false);
  });
});
