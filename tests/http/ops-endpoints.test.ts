import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleGetOpsInventory,
  handleGetOpsDiagnostics,
  setOpsDatabase,
} from '@/server/http/routes/ops-handler';
import { OPERATOR_COOKIE_NAME } from '@/server/http/auth/operator-guard';
import type { OpsFacts, PipelineFacts } from '@/contracts';

const { readOpsFacts, readPipelineFacts } = vi.hoisted(() => ({
  readOpsFacts: vi.fn(),
  readPipelineFacts: vi.fn(),
}));

vi.mock('@/server/commerce/facts', () => ({
  createCommerceFacts: () => ({
    readProductFacts: vi.fn(),
    readOpsFacts,
  }),
}));

vi.mock('@/server/events/diagnostics', () => ({
  createPipelineReader: () => readPipelineFacts,
}));

const mockOpsFacts: OpsFacts = {
  storeId: 'blr-01',
  checkedAt: '2026-11-22T00:00:00.000Z',
  stock: [
    {
      productId: 'blr-basmati-1kg',
      stockOnHand: 15,
      held: 2,
      available: 13,
      inventoryVersion: 4,
    },
    {
      productId: 'blr-atta-5kg',
      stockOnHand: 8,
      held: 0,
      available: 8,
      inventoryVersion: 2,
    },
  ],
  recentMovements: [
    {
      productId: 'blr-basmati-1kg',
      kind: 'ORDER',
      referenceId: 'ord-123',
      quantityDelta: -1,
      occurredAt: '2026-11-21T23:55:00.000Z',
    },
  ],
};

const mockPipelineFacts: PipelineFacts = {
  storeId: 'blr-01',
  checkedAt: '2026-11-22T00:00:00.000Z',
  pendingCount: 0,
  oldestPendingAt: null,
  lastBrokerAckAt: '2026-11-21T23:59:00.000Z',
  lastProjectionAcceptedAt: '2026-11-21T23:59:01.000Z',
  lastError: null,
  projectionRetryCount: 0,
  quarantineCount: 0,
  unattributedQuarantineCount: 0,
  recentEvents: [
    {
      eventId: 'evt-001',
      type: 'inventory.changed',
      occurredAt: '2026-11-21T23:59:00.000Z',
      publishedAt: '2026-11-21T23:59:00.500Z',
    },
  ],
};

function createRequest(
  url = 'http://localhost:3000/api/ops/inventory',
  token: string | null = 'ops_staff1_blr-01',
  cookieToken: string | null = null
) {
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (cookieToken) {
    headers.set('cookie', `${OPERATOR_COOKIE_NAME}=${cookieToken}`);
  }
  return new Request(url, {
    method: 'GET',
    headers,
  });
}

describe('Operations Read-Only API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOpsDatabase({ transact: vi.fn() });
  });

  describe('GET /api/ops/inventory', () => {
    it('returns inventory facts for authorized operator deriving storeId from session', async () => {
      readOpsFacts.mockResolvedValueOnce(mockOpsFacts);

      const req = createRequest('http://localhost:3000/api/ops/inventory', 'ops_staff1_blr-01');
      const res = await handleGetOpsInventory(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');

      const data = await res.json();
      expect(data).toEqual(mockOpsFacts);
      expect(readOpsFacts).toHaveBeenCalledWith('blr-01');
    });

    it('allows explicit storeId parameter if matching authorized operator storeId', async () => {
      readOpsFacts.mockResolvedValueOnce(mockOpsFacts);

      const req = createRequest('http://localhost:3000/api/ops/inventory?storeId=blr-01', 'ops_staff1_blr-01');
      const res = await handleGetOpsInventory(req);

      expect(res.status).toBe(200);
      expect(readOpsFacts).toHaveBeenCalledWith('blr-01');
    });

    it('rejects unauthorized store access with HTTP 403 FORBIDDEN', async () => {
      const req = createRequest('http://localhost:3000/api/ops/inventory?storeId=mys-01', 'ops_staff1_blr-01');
      const res = await handleGetOpsInventory(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN');
      expect(data.error.message).toContain('not authorized for this store');
      expect(readOpsFacts).not.toHaveBeenCalled();
    });

    it('authenticates successfully using HttpOnly cookie', async () => {
      readOpsFacts.mockResolvedValueOnce(mockOpsFacts);

      const req = createRequest('http://localhost:3000/api/ops/inventory', null, 'ops_staff1_blr-01');
      const res = await handleGetOpsInventory(req);

      expect(res.status).toBe(200);
      expect(readOpsFacts).toHaveBeenCalledWith('blr-01');
    });

    it('rejects missing operator session with HTTP 401 FORBIDDEN', async () => {
      const req = createRequest('http://localhost:3000/api/ops/inventory', null);
      const res = await handleGetOpsInventory(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN');
      expect(readOpsFacts).not.toHaveBeenCalled();
    });

    it('rejects invalid operator token with HTTP 403 FORBIDDEN', async () => {
      const req = createRequest('http://localhost:3000/api/ops/inventory', 'invalid-token');
      const res = await handleGetOpsInventory(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN');
      expect(readOpsFacts).not.toHaveBeenCalled();
    });

    it('rejects synthetic credentials outside demo/test mode', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('SMARTTIJORI_DEMO_MODE', 'false');
      try {
        const req = createRequest('http://localhost:3000/api/ops/inventory', 'ops_staff1_blr-01');
        const res = await handleGetOpsInventory(req);

        expect(res.status).toBe(403);
        expect(readOpsFacts).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('maps database/service errors to 500 DEPENDENCY_UNAVAILABLE', async () => {
      readOpsFacts.mockRejectedValueOnce(new Error('PostgreSQL connection timeout'));

      const req = createRequest('http://localhost:3000/api/ops/inventory', 'ops_staff1_blr-01');
      const res = await handleGetOpsInventory(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    });
  });

  describe('GET /api/ops/diagnostics', () => {
    it('returns pipeline diagnostics for authorized operator deriving storeId from session', async () => {
      readPipelineFacts.mockResolvedValueOnce(mockPipelineFacts);

      const req = createRequest('http://localhost:3000/api/ops/diagnostics', 'ops_staff1_blr-01');
      const res = await handleGetOpsDiagnostics(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');

      const data = await res.json();
      expect(data).toEqual(mockPipelineFacts);
      expect(readPipelineFacts).toHaveBeenCalledWith('blr-01');
    });

    it('allows explicit storeId parameter if matching authorized operator storeId', async () => {
      readPipelineFacts.mockResolvedValueOnce(mockPipelineFacts);

      const req = createRequest('http://localhost:3000/api/ops/diagnostics?storeId=blr-01', 'ops_staff1_blr-01');
      const res = await handleGetOpsDiagnostics(req);

      expect(res.status).toBe(200);
      expect(readPipelineFacts).toHaveBeenCalledWith('blr-01');
    });

    it('rejects unauthorized store access with HTTP 403 FORBIDDEN', async () => {
      const req = createRequest('http://localhost:3000/api/ops/diagnostics?storeId=mys-01', 'ops_staff1_blr-01');
      const res = await handleGetOpsDiagnostics(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN');
      expect(data.error.message).toContain('not authorized for this store');
      expect(readPipelineFacts).not.toHaveBeenCalled();
    });

    it('rejects missing operator session with HTTP 401 FORBIDDEN', async () => {
      const req = createRequest('http://localhost:3000/api/ops/diagnostics', null);
      const res = await handleGetOpsDiagnostics(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN');
      expect(readPipelineFacts).not.toHaveBeenCalled();
    });

    it('maps database/service errors to 500 DEPENDENCY_UNAVAILABLE', async () => {
      readPipelineFacts.mockRejectedValueOnce(new Error('Outbox query failed'));

      const req = createRequest('http://localhost:3000/api/ops/diagnostics', 'ops_staff1_blr-01');
      const res = await handleGetOpsDiagnostics(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    });
  });
});
