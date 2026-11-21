// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Alert } from '@/components/shop/feedback/alert';
import { StockBadge } from '@/components/shop/product/stock-badge';
import { HoldTimer } from '@/components/shop/checkout/hold-timer';
import { BranchCard } from '@/components/shop/store-selector/branch-card';
import { CheckoutView } from '@/components/shop/checkout/checkout-view';
import { api } from '@/lib/api-client';
import { MOCK_STORES } from '../fixtures/mock-data';

vi.mock('@/lib/session/store-context', () => ({
  useStore: () => ({
    cart: {
      id: 'cart-a11y',
      sessionId: 'sess-a11y',
      storeId: 'blr-01',
      lines: [{ productId: 'blr-basmati-1kg', quantity: 1, name: 'Rice', unitPricePaise: 100 }],
      totalPaise: 100,
    },
    isLoading: false,
    refreshCart: vi.fn(),
  }),
}));

vi.mock('@/lib/api-client', () => ({
  api: {
    createReservation: vi.fn(),
    confirmOrder: vi.fn(),
    getRecovery: vi.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    constructor(public code: string, message: string, public status = 400, public details = {}) {
      super(message);
    }
  },
}));

describe('Accessibility & UI Controls Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it('Alert has role="alert" and accessible message content', () => {
    render(<Alert type="warning" title="Test Alert">Important notice</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('Test Alert')).toBeInTheDocument();
    expect(screen.getByText('Important notice')).toBeInTheDocument();
  });

  it('StockBadge displays accurate status for available and out-of-stock items', () => {
    const { rerender } = render(<StockBadge available={10} />);
    expect(screen.getByText(/10 in stock/i)).toBeInTheDocument();

    rerender(<StockBadge available={2} />);
    expect(screen.getByText(/LastOne: Only 2 left!/i)).toBeInTheDocument();

    rerender(<StockBadge available={0} />);
    expect(screen.getByText(/Out of stock/i)).toBeInTheDocument();
  });

  it('keeps countdown ticks quiet for screen readers', () => {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 180000).toISOString();

    render(<HoldTimer expiresAt={expiresAt} serverNow={now} />);
    const timer = screen.getByRole('timer');
    expect(timer).toBeInTheDocument();
    expect(timer).toHaveAttribute('aria-live', 'off');
  });

  it('BranchCard provides keyboard-accessible interactive button', () => {
    const onSelect = vi.fn();
    render(
      <BranchCard
        store={MOCK_STORES[0]}
        isSelected={false}
        onSelect={onSelect}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(screen.getByText(MOCK_STORES[0].name)).toBeInTheDocument();
  });

  it('exposes hold-expired container with role="alert" and assertive live region for screen-reader announcement', async () => {
    vi.mocked(api.createReservation).mockResolvedValueOnce({
      id: 'hold-expired-a11y',
      cartId: 'cart-a11y',
      sessionId: 'sess-a11y',
      storeId: 'blr-01',
      status: 'ACTIVE',
      serverNow: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      lines: [{ productId: 'blr-basmati-1kg', quantity: 1, name: 'Rice', unitPricePaise: 100 }],
      totalPaise: 100,
    });

    render(<CheckoutView />);

    await waitFor(() => {
      const alertContainer = screen.getByRole('alert');
      expect(alertContainer).toBeInTheDocument();
      expect(alertContainer).toHaveAttribute('aria-live', 'assertive');
      expect(alertContainer).toHaveTextContent(/Reservation Expired/i);
    });
  });

  it('exposes initial CREATING_HOLD loading state with role="status", aria-live="polite", and aria-busy="true"', () => {
    // Keep createReservation pending to inspect the active loading state
    vi.mocked(api.createReservation).mockReturnValueOnce(new Promise(() => {}));

    render(<CheckoutView />);

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    expect(statusRegion).toHaveAttribute('aria-busy', 'true');
    expect(statusRegion).toHaveTextContent(/Securing CartLock Hold/i);
    expect(statusRegion).toHaveTextContent(/Contacting store inventory authority/i);
  });

  it('removes role="status" and aria-busy semantics when initial hold reservation succeeds', async () => {
    vi.mocked(api.createReservation).mockResolvedValueOnce({
      id: 'hold-success-a11y',
      cartId: 'cart-a11y',
      sessionId: 'sess-a11y',
      storeId: 'blr-01',
      status: 'ACTIVE',
      serverNow: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 59 * 1000).toISOString(),
      lines: [{ productId: 'blr-basmati-1kg', quantity: 1, name: 'Rice', unitPricePaise: 100 }],
      totalPaise: 100,
    });

    render(<CheckoutView />);

    await waitFor(() => {
      // Status semantics must be removed
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByText(/Securing CartLock Hold/i)).not.toBeInTheDocument();

      // Active hold card is displayed
      expect(screen.getByText('CartLock Reservation')).toBeInTheDocument();
      expect(screen.getByText('hold-success-a11y')).toBeInTheDocument();
    });
  });

  it('replaces role="status" with role="alert" when initial hold reservation fails with network error', async () => {
    vi.mocked(api.createReservation).mockRejectedValueOnce(
      new Error('Connection failure to reservation authority')
    );

    render(<CheckoutView />);

    await waitFor(() => {
      // Loading status is removed
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      // Error alert takes over
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Failed to connect to checkout reservation service/i)).toBeInTheDocument();
    });
  });
});
