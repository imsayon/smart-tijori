// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpsShell } from '@/components/ops/layout/ops-shell';
import OpsOverviewPage from '@/app/ops/page';
import OpsInventoryPage from '@/app/ops/inventory/page';
import OpsDiagnosticsPage from '@/app/ops/diagnostics/page';

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

  it('renders workbench brand, server-verified session pill, and runtime mode indicator', () => {
    render(
      <OpsShell>
        <div>Content</div>
      </OpsShell>
    );

    expect(screen.getByText(/Smart/i)).toBeInTheDocument();
    expect(screen.getByText(/Tijori/i)).toBeInTheDocument();
    expect(screen.getByText('Ops')).toBeInTheDocument();
    expect(screen.getByText(/blr-01/i)).toBeInTheDocument();
    expect(screen.getByText(/cashier \(operator\)/i)).toBeInTheDocument();
    expect(screen.getByText(/⚡ DEMO MODE/i)).toBeInTheDocument();
  });

  it('renders all four navigation items with expected links', () => {
    render(
      <OpsShell>
        <div>Content</div>
      </OpsShell>
    );

    const nav = screen.getByRole('navigation', { name: /Operations Navigation/i });
    expect(nav).toBeInTheDocument();

    const overviewLink = screen.getByRole('link', { name: /Overview/i });
    expect(overviewLink).toHaveAttribute('href', '/ops');

    const posLink = screen.getByRole('link', { name: /POS Terminal/i });
    expect(posLink).toHaveAttribute('href', '/ops/pos');

    const inventoryLink = screen.getByRole('link', { name: /Store Inventory/i });
    expect(inventoryLink).toHaveAttribute('href', '/ops/inventory');

    const diagnosticsLink = screen.getByRole('link', { name: /Diagnostics/i });
    expect(diagnosticsLink).toHaveAttribute('href', '/ops/diagnostics');
  });

  it('highlights the active navigation link based on current route', () => {
    // When on /ops/pos
    mockPathname.mockReturnValue('/ops/pos');

    render(
      <OpsShell>
        <div>Content</div>
      </OpsShell>
    );

    const posLink = screen.getByRole('link', { name: /POS Terminal/i });
    expect(posLink).toHaveAttribute('aria-current', 'page');

    const overviewLink = screen.getByRole('link', { name: /Overview/i });
    expect(overviewLink).not.toHaveAttribute('aria-current');
  });

  it('renders Operations Overview page with quick links to all workstreams', () => {
    render(<OpsOverviewPage />);

    expect(screen.getByText('SmartTijori Operations Workbench')).toBeInTheDocument();
    expect(screen.getByText('In-Store Cashier POS')).toBeInTheDocument();
    expect(screen.getByText('Store Inventory Monitor')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Diagnostics')).toBeInTheDocument();
    expect(screen.getByText(/Architectural Single-Stock Invariant/i)).toBeInTheDocument();
  });

  it('renders Coming Soon state on Inventory page without mock data', () => {
    render(<OpsInventoryPage />);

    expect(screen.getByText('Store Inventory Monitor')).toBeInTheDocument();
    expect(screen.getByText(/⏳ Coming Soon \(Phase 3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/server\/commerce\/facts\.ts \(readOpsFacts\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting platform owner command confirmation/i)).toBeInTheDocument();
  });

  it('renders Coming Soon state on Diagnostics page without duplicate consumers', () => {
    render(<OpsDiagnosticsPage />);

    expect(screen.getByText('Pipeline & Worker Diagnostics')).toBeInTheDocument();
    expect(screen.getByText(/⏳ Coming Soon \(Phase 4\)/i)).toBeInTheDocument();
    expect(screen.getByText(/server\/events\/diagnostics\.ts \(createPipelineReader\)/i)).toBeInTheDocument();
    expect(screen.getByText(/quarantineCount \(poison pill isolation\)/i)).toBeInTheDocument();
  });
});
