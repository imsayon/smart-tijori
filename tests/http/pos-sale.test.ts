import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePostPosSale } from '@/server/http/routes/pos-handler';
import type { CommerceCommands } from '@/server/contracts/commerce';

const { authorizePosSale } = vi.hoisted(() => ({
  authorizePosSale: vi.fn<CommerceCommands['authorizePosSale']>(),
}));
vi.mock('@/server/http/adapters', () => ({ getCommerceCommands: () => ({ authorizePosSale }) }));

function request(storeId = 'blr-01', token = 'ops_cashier_blr-01', origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/pos/sale', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      Origin: origin, Host: 'localhost:3000', 'Idempotency-Key': 'sale-1',
    },
    body: JSON.stringify({ storeId, barcode: ' ST:tea-250 ', quantity: 1, operatorId: 'untrusted' }),
  });
}

describe('POS sale endpoint', () => {
  beforeEach(() => authorizePosSale.mockReset());

  it('passes the trusted actor and operation key to PostgreSQL commerce', async () => {
    const sale = {
      saleId: 'sale-1', storeId: 'blr-01', status: 'CONFIRMED', source: 'postgresql',
      totalPaise: 15000, soldAt: '2026-11-21T12:00:00.000Z',
      lines: [{ name: 'Tea', productId: 'tea-250', quantity: 1, unitPricePaise: 15000, inventoryVersion: 2 }],
    } as const;
    authorizePosSale.mockResolvedValueOnce({ ok: true, value: { ...sale, lines: [...sale.lines] } });
    const response = await handlePostPosSale(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sale });
    expect(authorizePosSale).toHaveBeenCalledWith(
      { kind: 'operator', id: 'cashier', storeIds: ['blr-01'] },
      { storeId: 'blr-01', barcode: 'ST:tea-250', quantity: 1, key: 'sale-1' },
    );
  });

  it.each([
    ['STOCK_LOCKED_ONLINE', 409], ['IDEMPOTENCY_CONFLICT', 409],
    ['NOT_FOUND', 404], ['DEPENDENCY_UNAVAILABLE', 503],
  ] as const)('maps %s to %s', async (code, status) => {
    authorizePosSale.mockResolvedValueOnce({ ok: false, error: { code, message: 'Rejected' } });
    const response = await handlePostPosSale(request());
    expect(response.status).toBe(status);
    expect((await response.json()).error.code).toBe(code);
  });

  it('blocks cross-branch, invalid credentials, and cross-origin requests before allocation', async () => {
    expect((await handlePostPosSale(request('mys-01'))).status).toBe(403);
    expect((await handlePostPosSale(request('blr-01', 'missing'))).status).toBe(403);
    expect((await handlePostPosSale(request('blr-01', 'ops_cashier_blr-01', 'https://example.com'))).status).toBe(403);
    expect(authorizePosSale).not.toHaveBeenCalled();
  });

  it('rejects synthetic credentials outside demo/test mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SMARTTIJORI_DEMO_MODE', 'false');
    try {
      expect((await handlePostPosSale(request())).status).toBe(403);
      expect(authorizePosSale).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
