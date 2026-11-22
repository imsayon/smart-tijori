// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpsOverview } from '@/components/ops/overview/ops-overview';
import type { OpsFacts, PipelineFacts } from '@/contracts';

const inventoryFacts: OpsFacts = {
  storeId: 'blr-01', checkedAt: '2026-11-21T18:00:00.000Z',
  stock: [
    { productId: 'tea-250', stockOnHand: 10, held: 1, available: 9, inventoryVersion: 3 },
    { productId: 'rice-1kg', stockOnHand: 2, held: 0, available: 2, inventoryVersion: 5 },
    { productId: 'dal-500', stockOnHand: 0, held: 0, available: 0, inventoryVersion: 1 },
  ],
  recentMovements: [],
};

const pipelineFacts: PipelineFacts = {
  storeId: 'blr-01', checkedAt: '2026-11-21T18:00:00.000Z', pendingCount: 4,
  oldestPendingAt: '2026-11-21T17:55:00.000Z', lastBrokerAckAt: '2026-11-21T17:59:30.000Z',
  lastProjectionAcceptedAt: '2026-11-21T17:59:00.000Z',
  lastError: { code: 'TIMEOUT', at: '2026-11-21T17:58:00.000Z' },
  projectionRetryCount: 2, quarantineCount: 1, unattributedQuarantineCount: 0, recentEvents: [],
};

describe('Operations Overview', () => {
  it('shows branch-derived inventory and pipeline facts', () => {
    render(<OpsOverview storeId="blr-01" initialInventoryFacts={inventoryFacts} initialPipelineFacts={pipelineFacts} />);

    expect(screen.getByRole('heading', { name: /A clearer view of commerce/i })).toBeInTheDocument();
    expect(screen.getByText(/blr-01/)).toBeInTheDocument();
    expect(screen.getByText('Tracked SKUs')).toBeInTheDocument();
    expect(screen.getByText('Available units')).toBeInTheDocument();
    expect(screen.getByText('Stock attention')).toBeInTheDocument();
    expect(screen.getByText('Held units')).toBeInTheDocument();
    const stats = document.querySelector('.atelier-stats');
    expect(stats).toHaveTextContent('3');
    expect(stats).toHaveTextContent('11');
    expect(stats).toHaveTextContent('2');
    expect(stats).toHaveTextContent('1');
    expect(screen.getByText('Store updates')).toBeInTheDocument();
    expect(screen.getByText('Updates waiting to share')).toBeInTheDocument();
    expect(screen.getByText('TIMEOUT')).toBeInTheDocument();
    expect(screen.getByText('Last shared update')).toBeInTheDocument();
  });

  it('leaves unknown values blank and explains when sources are unavailable', () => {
    render(<OpsOverview />);
    const stats = document.querySelector('.atelier-stats');
    expect(stats).toHaveTextContent('Tracked SKUs—');
    expect(stats).toHaveTextContent('Available units—');
    expect(screen.getByText('Branch inventory is unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Activity is unavailable.')).toBeInTheDocument();
  });

  it('links the dashboard to counter, inventory, and activity', () => {
    render(<OpsOverview />);
    expect(screen.getByRole('link', { name: /Open counter/i })).toHaveAttribute('href', '/ops/cashier');
    expect(screen.getByRole('link', { name: /^Inventory/i })).toHaveAttribute('href', '/ops/inventory');
    expect(screen.getByRole('link', { name: /View activity/i })).toHaveAttribute('href', '/ops/diagnostics');
  });

  it('keeps the overview read-only', () => {
    render(<OpsOverview initialInventoryFacts={inventoryFacts} initialPipelineFacts={pipelineFacts} />);
    expect(screen.queryByRole('button', { name: /restock|publish|adjust/i })).not.toBeInTheDocument();
  });

  it('refreshes inventory and pipeline without a browser-selected store id', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => url.includes('/api/ops/inventory') ? inventoryFacts : pipelineFacts,
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<OpsOverview />);

    await userEvent.click(screen.getByRole('button', { name: /Refresh facts/i }));
    await waitFor(() => expect(screen.getByText('Tracked SKUs')).toBeInTheDocument());
    expect(screen.getByText('Updates waiting to share')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url] of fetchMock.mock.calls) expect(url).not.toContain('storeId');
    vi.unstubAllGlobals();
  });

  it('surfaces service errors without replacing missing facts with sample values', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 503, headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Branch data unavailable' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<OpsOverview />);

    await userEvent.click(screen.getByRole('button', { name: /Refresh facts/i }));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(screen.getAllByText('Branch data unavailable')).toHaveLength(2);
    expect(document.querySelector('.atelier-stats')).toHaveTextContent('Tracked SKUs—');
    vi.unstubAllGlobals();
  });
});
