// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpsOverview } from '@/components/ops/overview/ops-overview';
import type { OpsFacts, PipelineFacts } from '@/contracts';

const mockInventoryFacts: OpsFacts = {
  storeId: 'blr-01',
  checkedAt: '2026-11-21T18:00:00.000Z',
  stock: [
    {
      productId: 'tea-250',
      stockOnHand: 10,
      held: 1,
      available: 9,
      inventoryVersion: 3,
    },
    {
      productId: 'rice-1kg',
      stockOnHand: 2,
      held: 0,
      available: 2,
      inventoryVersion: 5,
    },
    {
      productId: 'dal-500',
      stockOnHand: 0,
      held: 0,
      available: 0,
      inventoryVersion: 1,
    },
  ],
  recentMovements: [],
};

const mockPipelineFacts: PipelineFacts = {
  storeId: 'blr-01',
  checkedAt: '2026-11-21T18:00:00.000Z',
  pendingCount: 4,
  oldestPendingAt: '2026-11-21T17:55:00.000Z',
  lastBrokerAckAt: '2026-11-21T17:59:30.000Z',
  lastProjectionAcceptedAt: '2026-11-21T17:59:00.000Z',
  lastError: {
    code: 'TIMEOUT',
    at: '2026-11-21T17:58:00.000Z',
  },
  projectionRetryCount: 2,
  quarantineCount: 1,
  unattributedQuarantineCount: 0,
  recentEvents: [],
};

describe('Operations Overview Screen', () => {
  it('renders inventory and pipeline operational summaries when facts are supplied', () => {
    render(
      <OpsOverview
        initialInventoryFacts={mockInventoryFacts}
        initialPipelineFacts={mockPipelineFacts}
      />
    );

    // Header & derived store
    expect(screen.getByText('SmartTijori Operations Workbench')).toBeInTheDocument();
    expect(screen.getByText('blr-01')).toBeInTheDocument();
    expect(screen.getByText('Read-Only')).toBeInTheDocument();

    // Inventory Summary metrics: 3 SKUs, onHand=12, held=1, available=11
    expect(screen.getByText('Store Inventory Summary')).toBeInTheDocument();
    expect(screen.getByText('Tracked SKUs')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();

    // Inventory warning indicators
    expect(screen.getByText(/1 SKU\(s\) Held by 59s Online Locks/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Low Stock SKU\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Out of Stock SKU\(s\)/i)).toBeInTheDocument();

    // Pipeline Summary metrics: pending=4, quarantine=1, retries=2, error=TIMEOUT
    expect(screen.getByText('Event Pipeline Telemetry')).toBeInTheDocument();
    expect(screen.getByText('Pending Events')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('TIMEOUT')).toBeInTheDocument();

    // Timestamps
    expect(screen.getByText('Last Broker Ack:')).toBeInTheDocument();
    expect(screen.getByText('Last Projection Accepted:')).toBeInTheDocument();
  });

  it('renders pending route disclosure when operational facts are unavailable', () => {
    render(<OpsOverview />);

    // Shows session-authorized branch instead of hardcoded store ID
    expect(screen.getByText('Session Authorized')).toBeInTheDocument();

    // Discloses pending route integrations without fake numbers
    expect(screen.getAllByText('⏳ Route Approval Pending').length).toBe(2);
    expect(screen.getByText(/readOpsFacts/i)).toBeInTheDocument();
    expect(screen.getByText(/createPipelineReader/i)).toBeInTheDocument();
  });

  it('provides accessible navigation links to POS, inventory, and diagnostics', () => {
    render(<OpsOverview />);

    const posLink = screen.getByRole('link', { name: /Open POS Terminal →/i });
    expect(posLink).toHaveAttribute('href', '/ops/pos');

    const invLinks = screen.getAllByRole('link', { name: /Inventory/i });
    expect(invLinks.some((l) => l.getAttribute('href') === '/ops/inventory')).toBe(true);

    const diagLinks = screen.getAllByRole('link', { name: /Diagnostics/i });
    expect(diagLinks.some((l) => l.getAttribute('href') === '/ops/diagnostics')).toBe(true);
  });

  it('enforces read-only behavior with zero mutation controls', () => {
    render(
      <OpsOverview
        initialInventoryFacts={mockInventoryFacts}
        initialPipelineFacts={mockPipelineFacts}
      />
    );

    // Confirm no restock or publish buttons exist
    expect(screen.queryByRole('button', { name: /restock/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /adjust/i })).not.toBeInTheDocument();
  });

  it('loads and displays both inventory and diagnostics sources upon refresh without client-supplied storeId', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/ops/inventory')) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => mockInventoryFacts,
        };
      }
      if (url.includes('/api/ops/diagnostics')) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => mockPipelineFacts,
        };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OpsOverview />);

    // Initially displays pending route disclosure
    expect(screen.getAllByText('⏳ Route Approval Pending').length).toBe(2);

    const refreshButton = screen.getByRole('button', { name: /Refresh operational facts/i });
    await userEvent.click(refreshButton);

    await waitFor(() => {
      // Inventory section populated
      expect(screen.getByText('Tracked SKUs')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('11')).toBeInTheDocument();

      // Pipeline section populated
      expect(screen.getByText('Pending Events')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('TIMEOUT')).toBeInTheDocument();
    });

    // Ensure neither call passed storeId in query
    for (const call of fetchMock.mock.calls) {
      expect(call[0]).not.toContain('storeId');
    }

    vi.unstubAllGlobals();
  });

  it('displays clear API error states in overview when endpoints fail without fabricating facts', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/ops/inventory')) {
        return {
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Inventory database down' },
          }),
        };
      }
      if (url.includes('/api/ops/diagnostics')) {
        return {
          ok: false,
          status: 503,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Kafka broker unreachable' },
          }),
        };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OpsOverview />);

    const refreshButton = screen.getByRole('button', { name: /Refresh operational facts/i });
    await userEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('⚠️ Error Loading Inventory')).toBeInTheDocument();
      expect(screen.getByText('Inventory database down')).toBeInTheDocument();
      expect(screen.getByText('⚠️ Error Loading Telemetry')).toBeInTheDocument();
      expect(screen.getByText('Kafka broker unreachable')).toBeInTheDocument();
    });

    // Zero fake metrics rendered
    expect(screen.queryByText('Tracked SKUs')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending Events')).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('verifies request contains no client-supplied storeId query parameter even when storeId prop is present', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/ops/inventory')) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => mockInventoryFacts,
        };
      }
      if (url.includes('/api/ops/diagnostics')) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => mockPipelineFacts,
        };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OpsOverview storeId="blr-01" />);

    const refreshButton = screen.getByRole('button', { name: /Refresh operational facts/i });
    await userEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('Tracked SKUs')).toBeInTheDocument();
    });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/ops/inventory');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/ops/diagnostics');

    vi.unstubAllGlobals();
  });
});
