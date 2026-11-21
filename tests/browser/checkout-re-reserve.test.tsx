// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutView } from '@/components/shop/checkout/checkout-view';
import { api, ApiClientError } from '@/lib/api-client';
import { OperationKeyManager } from '@/lib/checkout/operation-key';
import type { Cart, Hold } from '@/contracts';

const mockCart: Cart = {
  id: 'cart-shopper-123',
  sessionId: 'session-shopper-123',
  storeId: 'blr-01',
  lines: [
    {
      productId: 'blr-basmati-1kg',
      quantity: 2,
      name: 'Premium Basmati Rice',
      unitPricePaise: 18500,
    },
  ],
  totalPaise: 37000,
};

const mockRefreshCart = vi.fn();
const mockRemoveFromCart = vi.fn();

vi.mock('@/lib/session/store-context', () => ({
  useStore: () => ({
    cart: mockCart,
    refreshCart: mockRefreshCart,
    removeFromCart: mockRemoveFromCart,
  }),
}));

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      createReservation: vi.fn(),
      confirmOrder: vi.fn(),
      getRecovery: vi.fn().mockResolvedValue({
        alternatives: [],
        unavailableOffer: {
          productId: 'blr-basmati-1kg',
          storeId: 'blr-01',
          name: 'Premium Basmati Rice',
          pricePaise: 18500,
          category: 'pantry',
          unit: '1000 g',
          available: 0,
          checkedAt: new Date().toISOString(),
        },
      }),
    },
  };
});

describe('Checkout Re-Reserve & Retry Regression Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    OperationKeyManager.clearAll();
  });

  it('Expired hold displays expiration screen, and clicking Re-reserve creates fresh hold with new key and timer', async () => {
    const user = userEvent.setup();

    const now = Date.now();
    // First hold that is already expired
    const firstHold: Hold = {
      id: 'hold-expired-01',
      cartId: mockCart.id,
      sessionId: mockCart.sessionId,
      storeId: mockCart.storeId,
      status: 'ACTIVE',
      serverNow: new Date(now - 61 * 1000).toISOString(),
      expiresAt: new Date(now - 1000).toISOString(),
      lines: mockCart.lines,
      totalPaise: mockCart.totalPaise,
    };

    const freshHold: Hold = {
      id: 'hold-fresh-02',
      cartId: mockCart.id,
      sessionId: mockCart.sessionId,
      storeId: mockCart.storeId,
      status: 'ACTIVE',
      serverNow: new Date(now).toISOString(),
      expiresAt: new Date(now + 59 * 1000).toISOString(),
      lines: mockCart.lines,
      totalPaise: mockCart.totalPaise,
    };

    const createReservationMock = vi.mocked(api.createReservation);
    createReservationMock.mockResolvedValueOnce(firstHold).mockResolvedValueOnce(freshHold);

    render(<CheckoutView />);

    // Initial reservation is created
    await waitFor(() => {
      expect(createReservationMock).toHaveBeenCalledTimes(1);
    });

    const firstKey = createReservationMock.mock.calls[0][1];
    expect(firstKey).toBeDefined();

    // Since firstHold.expiresAt was in the past, HoldTimer triggers onExpire -> HOLD_EXPIRED screen
    await waitFor(() => {
      expect(screen.getByText('Reservation Expired')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Re-reserve Stock & Checkout →/i })).toBeInTheDocument();
    });

    // Click Re-reserve button
    const reReserveButton = screen.getByRole('button', { name: /Re-reserve Stock & Checkout →/i });
    await user.click(reReserveButton);

    // Verifies that a second reservation is requested
    await waitFor(() => {
      expect(createReservationMock).toHaveBeenCalledTimes(2);
    });

    const secondKey = createReservationMock.mock.calls[1][1];

    // Key must be genuinely new, not the old expired key
    expect(secondKey).not.toBe(firstKey);
    expect(secondKey.length).toBe(36); // Valid UUID

    // Checkout view transitions back to active hold with new reservation ID
    await waitFor(() => {
      expect(screen.getByText('hold-fresh-02')).toBeInTheDocument();
      expect(screen.getByText(/Stock reserved:/i)).toBeInTheDocument();
    });

    // Cart lines and quantities remain unchanged
    expect(screen.getByText('Premium Basmati Rice')).toBeInTheDocument();
    expect(screen.getByText(/× 2/)).toBeInTheDocument();
    expect(screen.getAllByText(/₹370/).length).toBeGreaterThan(0);
  });

  it('Re-reserve handles stock conflict gracefully and renders ConflictRecoveryPanel', async () => {
    const user = userEvent.setup();

    const now = Date.now();
    const firstHold: Hold = {
      id: 'hold-expired-01',
      cartId: mockCart.id,
      sessionId: mockCart.sessionId,
      storeId: mockCart.storeId,
      status: 'ACTIVE',
      serverNow: new Date(now - 61 * 1000).toISOString(),
      expiresAt: new Date(now - 1000).toISOString(),
      lines: mockCart.lines,
      totalPaise: mockCart.totalPaise,
    };

    const createReservationMock = vi.mocked(api.createReservation);
    createReservationMock
      .mockResolvedValueOnce(firstHold)
      .mockRejectedValueOnce(
        new ApiClientError(
          'STOCK_UNAVAILABLE',
          'Stock ran out while hold was expired',
          409,
          { unavailableProducts: ['blr-basmati-1kg'] }
        )
      );

    render(<CheckoutView />);

    await waitFor(() => {
      expect(screen.getByText('Reservation Expired')).toBeInTheDocument();
    });

    const reReserveButton = screen.getByRole('button', { name: /Re-reserve Stock & Checkout →/i });
    await user.click(reReserveButton);

    // Must transition to stock conflict panel showing recovery options
    await waitFor(() => {
      expect(screen.getByText(/This item just became unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/Your branch can no longer reserve/i)).toBeInTheDocument();
      expect(screen.getByText(/In-stock alternatives/i)).toBeInTheDocument();
    });
  });

  it('Network failure during reservation displays retryable error and allows safe retry reusing key', async () => {
    const user = userEvent.setup();

    const createReservationMock = vi.mocked(api.createReservation);
    createReservationMock
      .mockRejectedValueOnce(new Error('Network timeout contacting reservation authority'))
      .mockResolvedValueOnce({
        id: 'hold-success-03',
        cartId: mockCart.id,
        sessionId: mockCart.sessionId,
        storeId: mockCart.storeId,
        status: 'ACTIVE',
        serverNow: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 59 * 1000).toISOString(),
        lines: mockCart.lines,
        totalPaise: mockCart.totalPaise,
      });

    render(<CheckoutView />);

    // Should show error and retry button
    await waitFor(() => {
      expect(screen.getByText(/Failed to connect to checkout reservation service/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Reservation/i })).toBeInTheDocument();
    });

    const firstKey = createReservationMock.mock.calls[0][1];

    // Click Retry Reservation
    const retryButton = screen.getByRole('button', { name: /Retry Reservation/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(createReservationMock).toHaveBeenCalledTimes(2);
    });

    const secondKey = createReservationMock.mock.calls[1][1];

    // Retrying a network failure must reuse the original key (lost-response protection)
    expect(secondKey).toBe(firstKey);

    // Transitions to active hold
    await waitFor(() => {
      expect(screen.getByText('hold-success-03')).toBeInTheDocument();
    });
  });

  it('Double click does not trigger multiple reservation requests', async () => {
    const user = userEvent.setup();

    const now = Date.now();
    const expiredHold: Hold = {
      id: 'hold-1',
      cartId: mockCart.id,
      sessionId: mockCart.sessionId,
      storeId: mockCart.storeId,
      status: 'ACTIVE',
      serverNow: new Date(now - 61 * 1000).toISOString(),
      expiresAt: new Date(now - 1000).toISOString(),
      lines: mockCart.lines,
      totalPaise: mockCart.totalPaise,
    };

    let resolveSecondPromise: (value: Hold) => void;
    const secondPromise = new Promise<Hold>((resolve) => {
      resolveSecondPromise = resolve;
    });

    const createReservationMock = vi.mocked(api.createReservation);
    createReservationMock
      .mockResolvedValueOnce(expiredHold)
      .mockReturnValueOnce(secondPromise);

    render(<CheckoutView />);

    // Wait for initial hold to resolve and trigger expired state
    await waitFor(() => {
      expect(screen.getByText('Reservation Expired')).toBeInTheDocument();
    });

    expect(createReservationMock).toHaveBeenCalledTimes(1);

    const reReserveButton = screen.getByRole('button', { name: /Re-reserve Stock & Checkout →/i });

    // Simulate rapid double click
    await Promise.all([user.click(reReserveButton), user.click(reReserveButton)]);

    // Must still only be called once more (total 2 times, not 3)
    expect(createReservationMock).toHaveBeenCalledTimes(2);

    resolveSecondPromise!({
      id: 'hold-2',
      cartId: mockCart.id,
      sessionId: mockCart.sessionId,
      storeId: mockCart.storeId,
      status: 'ACTIVE',
      serverNow: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 59 * 1000).toISOString(),
      lines: mockCart.lines,
      totalPaise: mockCart.totalPaise,
    });
  });
});
