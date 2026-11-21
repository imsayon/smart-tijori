// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CheckoutView } from '@/components/shop/checkout/checkout-view';
import { api } from '@/lib/api-client';
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

let mockStoreState: {
  cart: Cart | null;
  isLoading: boolean;
  refreshCart: () => Promise<void>;
} = {
  cart: null,
  isLoading: true,
  refreshCart: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/lib/session/store-context', () => ({
  useStore: () => mockStoreState,
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

describe('Checkout Initial Loading UX Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows clear loading state while store is loading and does not flash empty cart message', () => {
    mockStoreState = {
      cart: null,
      isLoading: true,
      refreshCart: vi.fn().mockResolvedValue(undefined),
    };

    render(<CheckoutView />);

    // Must show loading state
    expect(screen.getByText('Loading your cart…')).toBeInTheDocument();
    expect(screen.getByText('Retrieving items from your local branch.')).toBeInTheDocument();

    // Must NOT flash "No active cart for checkout"
    expect(screen.queryByText(/No active cart for checkout/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Return to Store →/i)).not.toBeInTheDocument();
  });

  it('shows empty cart message once loading completes with no cart', () => {
    mockStoreState = {
      cart: null,
      isLoading: false,
      refreshCart: vi.fn().mockResolvedValue(undefined),
    };

    render(<CheckoutView />);

    // Must show empty cart message once loading is finished
    expect(screen.getByText('No active cart for checkout')).toBeInTheDocument();
    expect(screen.getByText(/Please add items from your local branch/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to Store →/i })).toBeInTheDocument();

    // Must not show loading state
    expect(screen.queryByText('Loading your cart…')).not.toBeInTheDocument();
  });

  it('proceeds to checkout reservation once cart is successfully loaded', async () => {
    const mockHold: Hold = {
      id: 'hold-loaded-01',
      cartId: mockCart.id,
      sessionId: mockCart.sessionId,
      storeId: mockCart.storeId,
      status: 'ACTIVE',
      serverNow: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 59 * 1000).toISOString(),
      lines: mockCart.lines,
      totalPaise: mockCart.totalPaise,
    };

    vi.mocked(api.createReservation).mockResolvedValueOnce(mockHold);

    mockStoreState = {
      cart: mockCart,
      isLoading: false,
      refreshCart: vi.fn().mockResolvedValue(undefined),
    };

    render(<CheckoutView />);

    // Cart loaded -> must NOT show loading or empty cart message
    expect(screen.queryByText('Loading your cart…')).not.toBeInTheDocument();
    expect(screen.queryByText(/No active cart for checkout/i)).not.toBeInTheDocument();

    // Must successfully trigger hold reservation
    await waitFor(() => {
      expect(screen.getByText('CartLock Reservation')).toBeInTheDocument();
      expect(screen.getByText('hold-loaded-01')).toBeInTheDocument();
    });
  });
});
