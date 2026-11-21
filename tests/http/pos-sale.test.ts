import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePostPosSale } from '@/server/http/routes/pos-handler';
import { OPERATOR_COOKIE_NAME } from '@/server/http/auth/operator-guard';
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

  // Extended Edge Cases (Preserving Canonical Handler Validation)
  it('rejects missing Idempotency-Key header with HTTP 400 VALIDATION_ERROR', async () => {
    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ops_cashier_blr-01',
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storeId: 'blr-01', barcode: 'ST:tea-250', quantity: 1 }),
    });

    const response = await handlePostPosSale(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(authorizePosSale).not.toHaveBeenCalled();
  });

  it('rejects invalid payload quantity with HTTP 400 VALIDATION_ERROR', async () => {
    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ops_cashier_blr-01',
        Origin: 'http://localhost:3000',
        'Idempotency-Key': 'sale-invalid-qty',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storeId: 'blr-01', barcode: 'ST:tea-250', quantity: 0 }),
    });

    const response = await handlePostPosSale(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(authorizePosSale).not.toHaveBeenCalled();
  });

  it('authenticates operator via st_ops_session cookie when Authorization header is absent', async () => {
    const sale = {
      saleId: 'sale-cookie-1', storeId: 'blr-01', status: 'CONFIRMED', source: 'postgresql',
      totalPaise: 15000, soldAt: '2026-11-21T12:00:00.000Z',
      lines: [{ name: 'Tea', productId: 'tea-250', quantity: 1, unitPricePaise: 15000, inventoryVersion: 2 }],
    } as const;
    authorizePosSale.mockResolvedValueOnce({ ok: true, value: { ...sale, lines: [...sale.lines] } });

    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: `${OPERATOR_COOKIE_NAME}=ops_cashier_blr-01`,
        Origin: 'http://localhost:3000',
        'Idempotency-Key': 'sale-cookie-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storeId: 'blr-01', barcode: 'ST:tea-250', quantity: 1 }),
    });

    const response = await handlePostPosSale(req);
    expect(response.status).toBe(200);
    expect(authorizePosSale).toHaveBeenCalledWith(
      { kind: 'operator', id: 'cashier', storeIds: ['blr-01'] },
      { storeId: 'blr-01', barcode: 'ST:tea-250', quantity: 1, key: 'sale-cookie-1' },
    );
  });
});
