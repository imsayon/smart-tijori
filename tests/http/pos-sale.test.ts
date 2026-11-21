import { describe, it, expect, beforeEach } from 'vitest';
import { handlePostPosSale } from '@/server/http/routes/pos-handler';
import { getCommerceCommands } from '@/server/http/adapters';
import { FixtureCommerceAdapter } from '@/server/http/adapters/fixture-commerce-adapter';
import { OPERATOR_COOKIE_NAME } from '@/server/http/auth/operator-guard';

describe('POS Barcode Sale Gate HTTP Tests (POST /api/pos/sale)', () => {
  let adapter: FixtureCommerceAdapter;

  beforeEach(() => {
    adapter = getCommerceCommands() as FixtureCommerceAdapter;
    adapter.resetState();
  });

  const validOperatorCookie = `${OPERATOR_COOKIE_NAME}=ops_staff01_blr-01`;

  it('authorizes a valid in-store barcode sale and decrements available stock', async () => {
    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: validOperatorCookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'pos-op-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        barcode: '8901030383123', // blr-basmati-1kg
        quantity: 1,
      }),
    });

    const res = await handlePostPosSale(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.sale).toBeDefined();
    expect(data.sale.ok).toBe(true);
    expect(data.sale.productId).toBe('blr-basmati-1kg');
    expect(data.sale.quantity).toBe(1);
    expect(data.sale.totalPaise).toBe(18500);
    expect(data.sale.source).toBe('FIXTURE_SIMULATED');
  });

  it('rejects requests without operator authentication with 401', async () => {
    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'pos-unauth-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        barcode: '8901030383123',
        quantity: 1,
      }),
    });

    const res = await handlePostPosSale(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe('FORBIDDEN');
    expect(data.error.message).toContain('Operator authentication required');
  });

  it('rejects invalid or tampered operator session credentials with 403', async () => {
    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: `${OPERATOR_COOKIE_NAME}=invalid_token_xyz`,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'pos-bad-auth-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        barcode: '8901030383123',
        quantity: 1,
      }),
    });

    const res = await handlePostPosSale(req);
    expect(res.status).toBe(403);
  });

  it('rejects requests with mismatched CSRF origin with 403', async () => {
    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: validOperatorCookie,
        origin: 'https://malicious-external-site.com',
        host: 'localhost:3000',
        'Idempotency-Key': 'pos-csrf-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        barcode: '8901030383123',
        quantity: 1,
      }),
    });

    const res = await handlePostPosSale(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe('FORBIDDEN');
  });

  it('rejects invalid payloads with 400 VALIDATION_ERROR', async () => {
    // Missing barcode
    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: validOperatorCookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'pos-val-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        quantity: 1,
      }),
    });

    const res = await handlePostPosSale(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing Idempotency-Key header with 400', async () => {
    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: validOperatorCookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        barcode: '8901030383123',
        quantity: 1,
      }),
    });

    const res = await handlePostPosSale(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toContain('Idempotency-Key');
  });

  it('rejects unknown barcodes with 404 BARCODE_UNKNOWN', async () => {
    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: validOperatorCookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'pos-unk-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        barcode: '9999999999999', // Unknown barcode
        quantity: 1,
      }),
    });

    const res = await handlePostPosSale(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe('BARCODE_UNKNOWN');
  });

  it('enforces single-stock truth: active online CartLock hold blocks POS sale of final available unit', async () => {
    // 1. Set available stock of Basmati rice to exactly 1 unit
    adapter.setStockOverride('blr-01', 'blr-basmati-1kg', 1);

    // 2. An online shopper creates a hold on this 1 unit
    const onlineSession = 'shopper-session-online-01';
    await adapter.updateCart(onlineSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cart = await adapter.getCart(onlineSession);
    const holdRes = await adapter.createHold(onlineSession, cart.id, 'online-hold-key-01');
    expect(holdRes.ok).toBe(true);

    // 3. In-store cashier attempts to scan the same barcode at POS while online hold is active
    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: validOperatorCookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'pos-race-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        barcode: '8901030383123', // blr-basmati-1kg
        quantity: 1,
      }),
    });

    const res = await handlePostPosSale(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error.code).toBe('STOCK_LOCKED_ONLINE');
    expect(data.error.message).toContain('active 59-second online checkout reservation');
    expect(data.error.details.availableStock).toBe(0);
    expect(data.error.details.activeHoldExpiresAt).toBeDefined();
  });

  it('enforces single-stock truth: POS-first sale causes a competing online reservation to fail', async () => {
    // 1. Set available stock of Basmati rice to exactly 1 unit
    adapter.setStockOverride('blr-01', 'blr-basmati-1kg', 1);

    // 2. In-store cashier authorizes POS sale first
    const posReq = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: validOperatorCookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'pos-first-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        barcode: '8901030383123',
        quantity: 1,
      }),
    });
    const posRes = await handlePostPosSale(posReq);
    expect(posRes.status).toBe(200);

    // 3. Online shopper now attempts to create a hold on the sold-out item
    const onlineSession = 'shopper-session-online-02';
    await adapter.updateCart(onlineSession, 'blr-01', [
      { productId: 'blr-basmati-1kg', quantity: 1 },
    ]);
    const cart = await adapter.getCart(onlineSession);
    const holdRes = await adapter.createHold(onlineSession, cart.id, 'online-hold-key-02');

    // Online hold must fail with STOCK_UNAVAILABLE
    expect(holdRes.ok).toBe(false);
    if (!holdRes.ok) {
      expect(holdRes.code).toBe('STOCK_UNAVAILABLE');
      expect(holdRes.unavailableProducts).toContain('blr-basmati-1kg');
    }
  });

  it('reusing the same Idempotency-Key returns the cached sale result without double-debiting', async () => {
    adapter.setStockOverride('blr-01', 'blr-basmati-1kg', 5);

    const makeRequest = () =>
      new Request('http://localhost:3000/api/pos/sale', {
        method: 'POST',
        headers: {
          cookie: validOperatorCookie,
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
          'Idempotency-Key': 'pos-idem-key-777',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId: 'blr-01',
          barcode: '8901030383123',
          quantity: 2,
        }),
      });

    // First call
    const res1 = await handlePostPosSale(makeRequest());
    expect(res1.status).toBe(200);
    const data1 = await res1.json();

    // Second call with same idempotency key (simulating scanner timeout/retry)
    const res2 = await handlePostPosSale(makeRequest());
    expect(res2.status).toBe(200);
    const data2 = await res2.json();

    expect(data1.sale.saleId).toBe(data2.sale.saleId);
    expect(data1.sale.totalPaise).toBe(data2.sale.totalPaise);

    // Offers should show remaining stock = 5 - 2 = 3 (NOT 5 - 4 = 1)
    const offers = await adapter.getProductOffers('blr-01');
    const basmati = offers.find((o) => o.productId === 'blr-basmati-1kg');
    expect(basmati?.available).toBe(3);
  });

  it('rejects idempotency conflict if same key is reused with different parameters', async () => {
    const req1 = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: validOperatorCookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'pos-conflict-key-888',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        barcode: '8901030383123',
        quantity: 1,
      }),
    });
    const res1 = await handlePostPosSale(req1);
    expect(res1.status).toBe(200);

    // Reuse key with different quantity
    const req2 = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: validOperatorCookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'pos-conflict-key-888',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        barcode: '8901030383123',
        quantity: 2,
      }),
    });
    const res2 = await handlePostPosSale(req2);
    expect(res2.status).toBe(409);
    const data2 = await res2.json();
    expect(data2.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('never trusts operatorId supplied in client request body', async () => {
    const req = new Request('http://localhost:3000/api/pos/sale', {
      method: 'POST',
      headers: {
        cookie: validOperatorCookie, // Session operator is staff01
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'Idempotency-Key': 'pos-spoof-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: 'blr-01',
        barcode: '8901030383123',
        quantity: 1,
        operatorId: 'spoofed-fake-admin-id', // Attacker attempt to spoof identity
      }),
    });

    const res = await handlePostPosSale(req);
    expect(res.status).toBe(200);
    // Sale succeeds under authenticated staff01; spoofed body field is safely discarded
  });

  describe('Operator-to-Store Authorization Enforcement', () => {
    it('allows sale when operator authorized for blr-01 requests sale for blr-01', async () => {
      const req = new Request('http://localhost:3000/api/pos/sale', {
        method: 'POST',
        headers: {
          cookie: `${OPERATOR_COOKIE_NAME}=ops_staff01_blr-01`,
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
          'Idempotency-Key': 'pos-match-store-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId: 'blr-01',
          barcode: '8901030383123',
          quantity: 1,
        }),
      });

      const res = await handlePostPosSale(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sale.storeId).toBe('blr-01');
    });

    it('rejects with 403 when operator authorized for blr-01 requests sale for blr-02 (cross-store)', async () => {
      const req = new Request('http://localhost:3000/api/pos/sale', {
        method: 'POST',
        headers: {
          cookie: `${OPERATOR_COOKIE_NAME}=ops_staff01_blr-01`, // Assigned to blr-01
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
          'Idempotency-Key': 'pos-cross-store-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId: 'blr-02', // Cross-store target
          barcode: '8901030383123',
          quantity: 1,
        }),
      });

      const res = await handlePostPosSale(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN');
      expect(data.error.message).toContain("not authorized to execute sales for store 'blr-02'");
    });

    it('rejects with 403 when operator has no store assignment (unrestricted access denied)', async () => {
      const req = new Request('http://localhost:3000/api/pos/sale', {
        method: 'POST',
        headers: {
          cookie: `${OPERATOR_COOKIE_NAME}=ops_unassignedoperator`, // No storeId part
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
          'Idempotency-Key': 'pos-nostore-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId: 'blr-01',
          barcode: '8901030383123',
          quantity: 1,
        }),
      });

      const res = await handlePostPosSale(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN');
      expect(data.error.message).toContain('Operator has no assigned store');
    });

    it('body-supplied storeId or role does not grant multi-store permission', async () => {
      const req = new Request('http://localhost:3000/api/pos/sale', {
        method: 'POST',
        headers: {
          cookie: `${OPERATOR_COOKIE_NAME}=ops_staff01_blr-01`, // Session is strictly blr-01
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
          'Idempotency-Key': 'pos-escalate-store-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId: 'blr-02',
          barcode: '8901030383123',
          quantity: 1,
          role: 'admin',
          permissions: ['*'], // Attacker attempts to claim multi-store permission
        }),
      });

      const res = await handlePostPosSale(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN');
    });
  });
});
