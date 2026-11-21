// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryView } from '@/components/ops/inventory/inventory-view';
import { InventoryStockTable } from '@/components/ops/inventory/inventory-stock-table';
import { InventoryMovementLedger } from '@/components/ops/inventory/inventory-movement-ledger';
import type { OpsFacts } from '@/contracts';

const mockOpsFacts: OpsFacts = {
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
      stockOnHand: 5,
      held: 5,
      available: 0,
      inventoryVersion: 7,
    },
    {
      productId: 'dal-500',
      stockOnHand: 0,
      held: 0,
      available: 0,
      inventoryVersion: 1,
    },
  ],
  recentMovements: [
    {
      productId: 'tea-250',
      kind: 'ORDER',
      referenceId: 'ord-101',
      quantityDelta: -1,
      occurredAt: '2026-11-21T17:55:00.000Z',
    },
    {
      productId: 'rice-1kg',
      kind: 'POS',
      referenceId: 'pos-202',
      quantityDelta: -2,
      occurredAt: '2026-11-21T17:50:00.000Z',
    },
    {
      productId: 'tea-250',
      kind: 'RESTOCK',
      referenceId: 'rst-303',
      quantityDelta: 20,
      occurredAt: '2026-11-21T16:00:00.000Z',
    },
  ],
};

describe('Operations Workbench Inventory Screen', () => {
  it('renders inventory metrics summary tiles accurately from OpsFacts', () => {
    render(<InventoryView initialFacts={mockOpsFacts} />);

    // Store indicator derived from facts
    expect(screen.getByText('blr-01')).toBeInTheDocument();
    expect(screen.getByText('Read-Only')).toBeInTheDocument();

    // Metric tiles: 3 SKUs, onHand=15, held=6, available=9
    expect(screen.getByText('Tracked SKUs')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('Stock on Hand')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();

    expect(screen.getByText('Held Online (CartLock)')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();

    expect(screen.getByText('Available to Sell')).toBeInTheDocument();
    expect(screen.getAllByText('9').length).toBeGreaterThan(0);
  });

  it('renders InventoryStockTable with on-hand, held, available, and version fields', () => {
    render(<InventoryStockTable stock={mockOpsFacts.stock} />);

    // Product IDs
    expect(screen.getByText('tea-250')).toBeInTheDocument();
    expect(screen.getByText('rice-1kg')).toBeInTheDocument();
    expect(screen.getByText('dal-500')).toBeInTheDocument();

    // Inventory versions
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('v7')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();

    // Status badges & column headers
    expect(screen.getByRole('columnheader', { name: 'Available' })).toBeInTheDocument();
    expect(screen.getByText('Locked Online')).toBeInTheDocument();
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });

  it('renders InventoryMovementLedger with kind badges, deltas, and reference IDs', () => {
    render(<InventoryMovementLedger movements={mockOpsFacts.recentMovements} />);

    // Movement types
    expect(screen.getByText('ORDER')).toBeInTheDocument();
    expect(screen.getByText('POS SALE')).toBeInTheDocument();
    expect(screen.getByText('RESTOCK')).toBeInTheDocument();

    // Deltas
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(screen.getByText('+20')).toBeInTheDocument();

    // Reference IDs
    expect(screen.getByText('ord-101')).toBeInTheDocument();
    expect(screen.getByText('pos-202')).toBeInTheDocument();
    expect(screen.getByText('rst-303')).toBeInTheDocument();
  });

  it('filters stock table in real-time when search term is entered', async () => {
    const user = userEvent.setup();
    render(<InventoryView storeId="blr-01" initialFacts={mockOpsFacts} />);

    const searchInput = screen.getByPlaceholderText(/Filter by SKU/i);
    await user.type(searchInput, 'rice');

    // Get the table element and check rows inside it
    const tables = screen.getAllByRole('table');
    const stockTable = tables[0];
    expect(within(stockTable).getByText('rice-1kg')).toBeInTheDocument();
    expect(within(stockTable).queryByText('tea-250')).not.toBeInTheDocument();
    expect(within(stockTable).queryByText('dal-500')).not.toBeInTheDocument();
  });

  it('renders empty state when branch has zero stock items', () => {
    const emptyFacts: OpsFacts = {
      storeId: 'blr-01',
      checkedAt: new Date().toISOString(),
      stock: [],
      recentMovements: [],
    };

    render(<InventoryView storeId="blr-01" initialFacts={emptyFacts} />);
    expect(screen.getByText(/No Inventory Tracked for Store blr-01/i)).toBeInTheDocument();
  });

  it('renders pending API state and session-authorized store badge when no storeId prop is provided', async () => {
    render(<InventoryView />);

    // Store badge displays Session Authorized instead of hardcoded store ID
    expect(screen.getByText('Session Authorized')).toBeInTheDocument();
    expect(screen.getByText(/Store Inventory Fact Projection Coming Soon/i)).toBeInTheDocument();
    expect(screen.getByText(/server\/commerce\/facts\.ts \(readOpsFacts\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting platform owner command confirmation/i)).toBeInTheDocument();

    // Clicking retry attempts fetch and stays in pending_api if 404
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })
    );

    const retryButton = screen.getByRole('button', { name: /Retry Connection/i });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText(/Store Inventory Fact Projection Coming Soon/i)).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('enforces read-only behavior: has no restock or mutation actions', () => {
    render(<InventoryView storeId="blr-01" initialFacts={mockOpsFacts} />);

    // Assert there are no restock buttons, adjust buttons, or quantity increment inputs
    expect(screen.queryByRole('button', { name: /restock/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /adjust/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add stock/i })).not.toBeInTheDocument();
  });

  it('loads inventory facts successfully via API and replaces pending state with real data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockOpsFacts,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<InventoryView />);
    expect(screen.getByText(/Store Inventory Fact Projection Coming Soon/i)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /Retry Connection/i });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Tracked SKUs')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getAllByText('tea-250').length).toBeGreaterThan(0);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/ops/inventory', expect.any(Object));
    expect(fetchMock.mock.calls[0][0]).not.toContain('storeId');

    vi.unstubAllGlobals();
  });

  it('displays clear error state when inventory API returns an error without fabricating data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'PostgreSQL connection timeout' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<InventoryView />);

    const retryButton = screen.getByRole('button', { name: /Retry Connection/i });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Store Inventory')).toBeInTheDocument();
      expect(screen.getByText('PostgreSQL connection timeout')).toBeInTheDocument();
    });

    expect(screen.queryByText('Tracked SKUs')).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('verifies request contains no client-supplied storeId query parameter even when storeId prop is present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockOpsFacts,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<InventoryView storeId="blr-01" />);

    const retryButton = screen.getByRole('button', { name: /Retry Connection/i });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Tracked SKUs')).toBeInTheDocument();
    });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/ops/inventory');
    expect(fetchMock.mock.calls[0][0]).not.toContain('storeId');

    vi.unstubAllGlobals();
  });
});
