// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiagnosticsView } from '@/components/ops/diagnostics/diagnostics-view';
import { PipelineMetricCards } from '@/components/ops/diagnostics/pipeline-metric-cards';
import { PipelineEventsTable } from '@/components/ops/diagnostics/pipeline-events-table';
import type { PipelineFacts } from '@/contracts';

const mockPipelineFacts: PipelineFacts = {
  storeId: 'blr-01',
  checkedAt: '2026-11-21T18:00:00.000Z',
  pendingCount: 2,
  oldestPendingAt: '2026-11-21T17:58:00.000Z',
  lastBrokerAckAt: '2026-11-21T17:59:30.000Z',
  lastProjectionAcceptedAt: '2026-11-21T17:59:00.000Z',
  lastError: {
    code: 'OPENSEARCH_TIMEOUT',
    at: '2026-11-21T17:57:00.000Z',
  },
  projectionRetryCount: 3,
  quarantineCount: 1,
  unattributedQuarantineCount: 0,
  recentEvents: [
    {
      eventId: 'evt-001',
      type: 'inventory.changed',
      occurredAt: '2026-11-21T17:59:00.000Z',
      publishedAt: '2026-11-21T17:59:30.000Z',
    },
    {
      eventId: 'evt-002',
      type: 'order.placed',
      occurredAt: '2026-11-21T17:58:00.000Z',
      publishedAt: null,
    },
  ],
};

const mockHealthyFacts: PipelineFacts = {
  storeId: 'blr-01',
  checkedAt: '2026-11-21T18:00:00.000Z',
  pendingCount: 0,
  oldestPendingAt: null,
  lastBrokerAckAt: '2026-11-21T17:59:30.000Z',
  lastProjectionAcceptedAt: '2026-11-21T17:59:00.000Z',
  lastError: null,
  projectionRetryCount: 0,
  quarantineCount: 0,
  unattributedQuarantineCount: 0,
  recentEvents: [
    {
      eventId: 'evt-003',
      type: 'inventory.changed',
      occurredAt: '2026-11-21T17:59:00.000Z',
      publishedAt: '2026-11-21T17:59:30.000Z',
    },
  ],
};

describe('Operations Workbench Diagnostics Screen', () => {
  it('renders pipeline telemetry cards accurately from PipelineFacts', () => {
    render(<PipelineMetricCards facts={mockPipelineFacts} />);

    // Queue depth
    expect(screen.getByText('Unsent updates')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Broker ack and projection
    expect(screen.getByText('Last shared update')).toBeInTheDocument();
    expect(screen.getByText('Availability updated')).toBeInTheDocument();

    // Quarantine and retries
    expect(screen.getByText('Updates needing review')).toBeInTheDocument();
    expect(screen.getByText(/need review \/ 3 retries/i)).toBeInTheDocument();

    // Error banner
    expect(screen.getByText(/Last Update issue: OPENSEARCH_TIMEOUT/i)).toBeInTheDocument();

    // Attention status
    expect(screen.getByText('ATTENTION REQUIRED')).toBeInTheDocument();
  });

  it('renders healthy status only when queue is empty, zero errors/retries, and all evidence is confirmed', () => {
    render(<PipelineMetricCards facts={mockHealthyFacts} />);

    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
    expect(screen.getByText(/Store updates are up to date/i)).toBeInTheDocument();
    expect(screen.getByText('Nothing pending')).toBeInTheDocument();
    expect(screen.queryByText(/Last Update issue/i)).not.toBeInTheDocument();
  });

  it('treats missing broker acknowledgement as UNCONFIRMED / IDLE instead of HEALTHY', () => {
    const unconfirmedBroker: PipelineFacts = {
      ...mockHealthyFacts,
      lastBrokerAckAt: null,
    };

    render(<PipelineMetricCards facts={unconfirmedBroker} />);

    expect(screen.getByText('UNCONFIRMED / IDLE')).toBeInTheDocument();
    expect(screen.getByText('Waiting for first shared update')).toBeInTheDocument();
    expect(screen.queryByText('HEALTHY')).not.toBeInTheDocument();
  });

  it('treats missing projection acceptance as UNCONFIRMED / IDLE instead of HEALTHY', () => {
    const unconfirmedProjection: PipelineFacts = {
      ...mockHealthyFacts,
      lastProjectionAcceptedAt: null,
    };

    render(<PipelineMetricCards facts={unconfirmedProjection} />);

    expect(screen.getByText('UNCONFIRMED / IDLE')).toBeInTheDocument();
    expect(screen.getByText('Waiting for updated availability')).toBeInTheDocument();
    expect(screen.queryByText('HEALTHY')).not.toBeInTheDocument();
  });

  it('treats existing lastError with zero pending events as ATTENTION REQUIRED instead of HEALTHY', () => {
    const factsWithError: PipelineFacts = {
      ...mockHealthyFacts,
      lastError: {
        code: 'SCHEMA_REGISTRY_DOWN',
        at: '2026-11-21T17:55:00.000Z',
      },
    };

    render(<PipelineMetricCards facts={factsWithError} />);

    expect(screen.getByText('ATTENTION REQUIRED')).toBeInTheDocument();
    expect(screen.getAllByText(/Update issue: SCHEMA_REGISTRY_DOWN/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('HEALTHY')).not.toBeInTheDocument();
  });

  it('detects unattributed quarantine and triggers quarantine warning', () => {
    const unattributedQuarantineFacts: PipelineFacts = {
      ...mockHealthyFacts,
      quarantineCount: 0,
      unattributedQuarantineCount: 2,
    };

    render(<PipelineMetricCards facts={unattributedQuarantineFacts} />);

    expect(screen.getByText('ATTENTION REQUIRED')).toBeInTheDocument();
    expect(screen.getByText('Some store updates need attention')).toBeInTheDocument();
    expect(screen.getByText(/\(2 unattributed\)/i)).toBeInTheDocument();
    expect(screen.queryByText('HEALTHY')).not.toBeInTheDocument();
  });

  it('renders PipelineEventsTable with event types, IDs, and publication statuses', () => {
    render(<PipelineEventsTable events={mockPipelineFacts.recentEvents} />);

    // Event IDs
    expect(screen.getByText('evt-001')).toBeInTheDocument();
    expect(screen.getByText('evt-002')).toBeInTheDocument();

    // Event Types
    expect(screen.getByText('Stock updated')).toBeInTheDocument();
    expect(screen.getByText('Order placed')).toBeInTheDocument();

    // Publication Statuses
    expect(screen.getByText('Shared')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Not shared yet')).toBeInTheDocument();
  });

  it('renders full DiagnosticsView with initialFacts and session-authorized store indicator', () => {
    render(<DiagnosticsView initialFacts={mockPipelineFacts} />);

    // Derived store indicator from facts
    expect(screen.getByText('blr-01')).toBeInTheDocument();
    expect(screen.getByText('Read-Only')).toBeInTheDocument();
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
    expect(screen.getByText('evt-001')).toBeInTheDocument();
  });

  it('renders pending API state and session-authorized badge when no initialFacts are passed', async () => {
    render(<DiagnosticsView />);

    // Badge indicates session-authorized instead of hardcoded store ID
    expect(screen.getByText('Session Authorized')).toBeInTheDocument();
    expect(screen.getByText('Store activity & sync')).toBeInTheDocument();
    expect(screen.getByText(/Not available just yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting review/i)).toBeInTheDocument();

    // Clicking retry attempts fetch and stays in pending_api if 404
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })
    );

    const retryButton = screen.getByRole('button', { name: /Try again/i });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText(/Store activity is temporarily unavailable/i)).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('renders empty state when zero events and zero pending count are returned', () => {
    const emptyFacts: PipelineFacts = {
      storeId: 'blr-01',
      checkedAt: new Date().toISOString(),
      pendingCount: 0,
      oldestPendingAt: null,
      lastBrokerAckAt: null,
      lastProjectionAcceptedAt: null,
      lastError: null,
      projectionRetryCount: 0,
      quarantineCount: 0,
      unattributedQuarantineCount: 0,
      recentEvents: [],
    };

    render(<DiagnosticsView initialFacts={emptyFacts} />);
    expect(screen.getByText(/No recent store activity/i)).toBeInTheDocument();
  });

  it('enforces read-only behavior: has no retry, publish, or flush actions', () => {
    render(<DiagnosticsView initialFacts={mockPipelineFacts} />);

    // Assert there are no publish buttons, retry buttons, or flush controls
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /flush/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /replay/i })).not.toBeInTheDocument();
  });

  it('loads diagnostics telemetry successfully via API and replaces pending state with real data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockPipelineFacts,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DiagnosticsView />);
    expect(screen.getByText(/Store activity is temporarily unavailable/i)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /Try again/i });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Unsent updates')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('evt-001')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/ops/diagnostics', expect.any(Object));
    expect(fetchMock.mock.calls[0][0]).not.toContain('storeId');

    vi.unstubAllGlobals();
  });

  it('displays clear error state when diagnostics API returns an error without fabricating data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Kafka broker unavailable' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DiagnosticsView />);

    const retryButton = screen.getByRole('button', { name: /Try again/i });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Activity is temporarily unavailable')).toBeInTheDocument();
      expect(screen.getByText('Kafka broker unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Unsent updates')).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('verifies request contains no client-supplied storeId query parameter even when storeId prop is present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockPipelineFacts,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DiagnosticsView storeId="blr-01" />);

    const retryButton = screen.getByRole('button', { name: /Try again/i });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Unsent updates')).toBeInTheDocument();
    });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/ops/diagnostics');
    expect(fetchMock.mock.calls[0][0]).not.toContain('storeId');

    vi.unstubAllGlobals();
  });
});
