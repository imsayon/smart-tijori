// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OPERATOR_ROLE } from '@server/http/auth/operator-guard';
import { OpsShell } from '@/components/ops/layout/ops-shell';
import OpsOverviewPage from '@/app/ops/page';
import OpsInventoryPage from '@/app/ops/inventory/page';
import OpsDiagnosticsPage from '@/app/ops/diagnostics/page';

const actor = { operatorId: 'cashier', role: OPERATOR_ROLE, storeId: 'blr-01' };
vi.mock('@/app/ops/operator', () => ({
  readWorkbenchOperator: async () => ({ actor, fixture: false }),
}));
vi.mock('@server/db/runtime', () => ({ getCommerceDatabase: () => ({}) }));
vi.mock('@server/commerce/facts', () => ({
  createCommerceFacts: () => ({
    readOpsFacts: async (storeId: string) => ({
      storeId, checkedAt: '2026-11-21T08:00:00.000Z',
      stock: [{ productId: 'tea-250', stockOnHand: 5, held: 1, available: 4, inventoryVersion: 7 }],
      recentMovements: [],
    }),
  }),
}));
vi.mock('@server/events/diagnostics', () => ({
  createPipelineReader: () => async (storeId: string) => ({
    storeId, checkedAt: '2026-11-21T08:00:00.000Z', pendingCount: 0,
    oldestPendingAt: null, lastBrokerAckAt: '2026-11-21T08:00:00.000Z', lastProjectionAcceptedAt: null,
    projectionRetryCount: 0, quarantineCount: 0, unattributedQuarantineCount: 0, lastError: null,
    recentEvents: [{ eventId: 'one', type: 'inventory.changed', occurredAt: '2026-11-21T07:59:00.000Z', publishedAt: '2026-11-21T08:00:00.000Z' }],
  }),
}));

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

describe('Operations Workbench Shell & Navigation Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPathname.mockReturnValue('/ops');
  });

  it('renders the workbench brand, branch, account, and runtime mode', () => {
    render(
      <OpsShell operator={actor} fixture>
        <div>Content</div>
      </OpsShell>
    );

    expect(screen.getByText(/Smart/i)).toBeInTheDocument();
    expect(screen.getByText(/Tijori/i)).toBeInTheDocument();
    expect(document.querySelector('.atelier-branch-chip')).toHaveTextContent('blr-01');
    expect(screen.getByText('cashier')).toBeInTheDocument();
    expect(screen.getByText('Demo mode')).toBeInTheDocument();
  });

  it('renders the primary tabs and reveals the remaining pages from the menu', async () => {
    const { container } = render(
      <OpsShell operator={actor} fixture>
        <div>Content</div>
      </OpsShell>
    );

    const nav = screen.getByRole('navigation', { name: /Operations Navigation/i });
    expect(nav).toBeInTheDocument();

    const overviewLink = screen.getByRole('link', { name: /Overview/i });
    expect(overviewLink).toHaveAttribute('href', '/ops');

    const posLink = screen.getByRole('link', { name: 'POS' });
    expect(posLink).toHaveAttribute('href', '/ops/pos');

    const inventoryLink = screen.getByRole('link', { name: 'Inventory' });
    expect(inventoryLink).toHaveAttribute('href', '/ops/inventory');

    const diagnosticsLink = screen.getByRole('link', { name: 'Activity' });
    expect(diagnosticsLink).toHaveAttribute('href', '/ops/diagnostics');

    await userEvent.click(container.querySelector('summary[aria-label="Open workspace menu"]')!);
    expect(screen.getByRole('link', { name: 'Reservations' })).toHaveAttribute('href', '/ops/reservations');
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/ops/orders');
  });

  it('highlights the active navigation link based on current route', () => {
    // When on /ops/pos
    mockPathname.mockReturnValue('/ops/pos');

    render(
      <OpsShell operator={actor} fixture>
        <div>Content</div>
      </OpsShell>
    );

    const posLink = screen.getByRole('link', { name: 'POS' });
    expect(posLink).toHaveAttribute('aria-current', 'page');

    const overviewLink = screen.getByRole('link', { name: /Overview/i });
    expect(overviewLink).not.toHaveAttribute('aria-current');
  });

  it('renders the editorial Overview and links to the operational data views', async () => {
    render(await OpsOverviewPage());

    expect(screen.getByRole('heading', { name: /A clearer view of commerce/i })).toBeInTheDocument();
    expect(screen.getByText('One stock ledger')).toBeInTheDocument();
    expect(screen.getByText('Recent stock movements')).toBeInTheDocument();
    expect(screen.getByText('Event pipeline')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open counter/i })).toHaveAttribute('href', '/ops/pos');
  });

  it('renders authoritative held and available quantities', async () => {
    render(await OpsInventoryPage());
    expect(screen.getByText('Store Inventory Monitor')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /tea-250/ });
    expect(within(row).getAllByRole('cell').map(cell => cell.textContent)).toEqual(
      expect.arrayContaining(['5', expect.stringMatching(/\b1$/), '4', 'v7']),
    );
  });

  it('renders pipeline status from the existing reader', async () => {
    render(await OpsDiagnosticsPage());
    expect(screen.getByText('Pipeline & Worker Diagnostics')).toBeInTheDocument();
    expect(screen.getByText(/Outbox Queue Depth/i)).toBeInTheDocument();
    const event = screen.getByRole('row', { name: /inventory.changed/ });
    expect(within(event).getByText('Acked')).toBeInTheDocument();
  });
});
