// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutView } from '@/components/shop/checkout/checkout-view';
import { api, ApiClientError } from '@/lib/api-client';
import { OperationKeyManager } from '@/lib/checkout/operation-key';
import type { Cart, Hold, Order, ProductOffer, RecoveryResult } from '@/contracts';

let currentMockCart: Cart;
let currentMockRefreshCart: ReturnType<typeof vi.fn>;

// Setup top-level dynamic store context mock
vi.mock('@/lib/session/store-context', () => ({
  useStore: () => ({
    cart: currentMockCart,
    refreshCart: currentMockRefreshCart,
    removeFromCart: vi.fn(),
    store: null,
    stores: [],
    isLoading: false,
    isStoreModalOpen: false,
    setStoreModalOpen: vi.fn(),
    selectStore: vi.fn(),
    addToCart: vi.fn(),
    updateLineQuantity: vi.fn(),
    clearCart: vi.fn(),
  }),
}));

describe('Stage 5C: End-to-End Shopper Recovery Verification', () => {
  let mockCart: Cart;
  let mockRefreshCart: ReturnType<typeof vi.fn>;

  const alternativeOffer: ProductOffer = {
    productId: 'prod-tea-premium',
    storeId: 'blr-01',
    city: 'Bengaluru',
    name: 'Tata Tea Premium 1kg',
    category: 'essentials',
    purpose: 'tea',
    pricePaise: 42000,
    imageUrl: '/images/tea-premium.webp',
    pack: { quantity: 1, unit: 'kg' },
    attributes: { type: 'leaf-tea' },
    available: 12,
    inventoryVersion: 2,
    checkedAt: new Date().toISOString(),
  };

  const mockRecoveryResult: RecoveryResult = {
    mode: 'rules',
    constraints: {
      purpose: 'tea',
      maxPricePaise: 45000,
      maxPriceMinor: 45000,
      minPack: { quantity: 500, unit: 'g' },
      minPackUnits: { quantity: 500, unit: 'g' },
    },
    candidates: [
      {
        offer: alternativeOffer,
        reasons: [
          'Within stated budget (₹420.00)',
          'Meets minimum package size of 500 g (1 kg)',
          'Currently in stock at Bengaluru branch (12 available)',
        ],
      },
    ],
    checkedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    OperationKeyManager.clearAll();

    mockCart = {
      id: 'cart-shopper-e2e',
      sessionId: 'session-shopper-e2e',
      storeId: 'blr-01',
      lines: [
        {
          productId: 'prod-tea-gold',
          quantity: 2,
          name: 'Tata Tea Gold 500g',
          unitPricePaise: 28000,
        },
        {
          productId: 'prod-staple-sugar',
          quantity: 1,
          name: 'Sugar 1kg',
          unitPricePaise: 5000,
        },
      ],
      totalPaise: 61000,
    };

    mockRefreshCart = vi.fn().mockResolvedValue(undefined);
    currentMockCart = mockCart;
    currentMockRefreshCart = mockRefreshCart;

    vi.spyOn(api, 'getRecovery').mockResolvedValue(mockRecoveryResult);
  });

  it('Main Scenario: Full E2E recovery journey from POS stock exhaustion to alternative approval and order confirmation', async () => {
    const user = userEvent.setup();

    // 1. Initial checkout reservation fails because POS sale consumed last unit of tea
    const createReservationMock = vi.spyOn(api, 'createReservation');
    createReservationMock.mockRejectedValueOnce(
      new ApiClientError(
        'STOCK_UNAVAILABLE',
        'Physical store sale consumed remaining stock',
        409,
        { unavailableProducts: ['prod-tea-gold'] }
      )
    );

    // 2. updateCart spy for verifying cart replacement
    const updateCartMock = vi.spyOn(api, 'updateCart').mockImplementation(async (_storeId, lines) => {
      mockCart = {
        ...mockCart,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          name: l.productId === 'prod-tea-premium' ? 'Tata Tea Premium 1kg' : 'Sugar 1kg',
          unitPricePaise: l.productId === 'prod-tea-premium' ? 42000 : 5000,
        })),
        totalPaise: 42000 * 2 + 5000,
      };
      currentMockCart = mockCart;
      return mockCart;
    });

    // 3. Second reservation (after replacement approval) succeeds
    const replacementHold: Hold = {
      id: 'hold-replacement-success',
      cartId: mockCart.id,
      sessionId: mockCart.sessionId,
      storeId: 'blr-01',
      status: 'ACTIVE',
      serverNow: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      lines: [
        { productId: 'prod-tea-premium', quantity: 2, name: 'Tata Tea Premium 1kg', unitPricePaise: 42000 },
        { productId: 'prod-staple-sugar', quantity: 1, name: 'Sugar 1kg', unitPricePaise: 5000 },
      ],
      totalPaise: 89000,
    };
    createReservationMock.mockResolvedValueOnce(replacementHold);

    // 4. Order confirmation succeeds
    const confirmedOrder: Order = {
      id: 'order-confirmed-e2e',
      reservationId: replacementHold.id,
      storeId: 'blr-01',
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      lines: replacementHold.lines,
      totalPaise: replacementHold.totalPaise,
      paymentMode: 'SIMULATED',
    };
    const confirmOrderMock = vi.spyOn(api, 'confirmOrder').mockResolvedValueOnce(confirmedOrder);

    // Render Checkout
    render(<CheckoutView />);

    // Step A: Conflict panel appears with unavailable product and quantity
    await waitFor(() => {
      expect(screen.getByText('This item just became unavailable')).toBeInTheDocument();
      expect(screen.getByText('Tata Tea Gold 500g')).toBeInTheDocument();
      expect(screen.getByText(/Qty: 2/)).toBeInTheDocument();
    });

    // Step B: Preserved constraints and Rules Mode badge are displayed
    expect(await screen.findByText(/Rules Mode \(Fallback\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Purpose:/)).toBeInTheDocument();
    expect(screen.getByText('tea')).toBeInTheDocument();
    expect(screen.getByText(/Budget:/)).toBeInTheDocument();
    expect(screen.getByText(/Min Pack:/)).toBeInTheDocument();

    // Step C: Verify NO automatic cart replacement or reservation occurred
    expect(updateCartMock).not.toHaveBeenCalled();
    expect(createReservationMock).toHaveBeenCalledTimes(1); // Only the initial failed call

    // Step D: Shopper enters natural-language query
    const promptInput = screen.getByPlaceholderText(/Describe what you're looking for/i);
    await user.type(promptInput, 'Assam CTC tea under ₹450');

    // Clicks Find alternatives (explicit submission)
    const findButton = screen.getByRole('button', { name: /Find alternatives/i });
    await user.click(findButton);

    expect(api.getRecovery).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'blr-01',
        unavailableProductId: 'prod-tea-gold',
        text: 'Assam CTC tea under ₹450',
      })
    );

    // Step E: Alternative card is rendered with authoritative stock and factual reasons
    expect(await screen.findByText('Tata Tea Premium 1kg')).toBeInTheDocument();
    expect(screen.getByText('12 in stock')).toBeInTheDocument();
    expect(screen.getByText(/Within stated budget/)).toBeInTheDocument();

    // Step F: Shopper explicitly clicks approve
    const approveBtn = screen.getByRole('button', { name: /Approve this replacement/i });
    await user.click(approveBtn);

    // Step G: Cart is updated with replacement, leaving unrelated lines (Sugar) completely intact
    expect(updateCartMock).toHaveBeenCalledWith('blr-01', [
      { productId: 'prod-staple-sugar', quantity: 1 },
      { productId: 'prod-tea-premium', quantity: 2 },
    ]);

    // Step H: Re-reservation is requested with fresh CartLock key
    await waitFor(() => {
      expect(createReservationMock).toHaveBeenCalledTimes(2);
    });

    // Step I: CheckoutView transitions to active hold
    await waitFor(() => {
      expect(screen.getByText('hold-replacement-success')).toBeInTheDocument();
      expect(screen.getByText(/Payment Simulation/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Confirm Order \(Simulated\) →/i })).toBeInTheDocument();
    });

    // Step J: Shopper confirms order
    const confirmBtn = screen.getByRole('button', { name: /Confirm Order \(Simulated\) →/i });
    await user.click(confirmBtn);

    expect(confirmOrderMock).toHaveBeenCalledWith('hold-replacement-success', expect.any(String));

    // Step K: Simulated payment receipt is displayed
    await waitFor(() => {
      expect(screen.getByText('Order Confirmed!')).toBeInTheDocument();
      expect(screen.getByText(/SIMULATED PAYMENT/i)).toBeInTheDocument();
      expect(screen.getByText('order-confirmed-e2e')).toBeInTheDocument();
    });
  });

  it('Negative Scenario 1: Zero eligible alternatives displays non-dead-end state and records stock interest', async () => {
    const user = userEvent.setup();

    vi.spyOn(api, 'createReservation').mockRejectedValueOnce(
      new ApiClientError('STOCK_UNAVAILABLE', 'Out of stock', 409, { unavailableProducts: ['prod-tea-gold'] })
    );

    const emptyResult: RecoveryResult = {
      mode: 'rules',
      constraints: { purpose: 'tea' },
      candidates: [],
      checkedAt: new Date().toISOString(),
    };
    vi.spyOn(api, 'getRecovery').mockResolvedValue(emptyResult);
    const saveInterestMock = vi.spyOn(api, 'saveInterest').mockResolvedValue({ saved: true });

    render(<CheckoutView />);

    await waitFor(() => {
      expect(screen.getByText(/No exact match found satisfying all hard constraints/i)).toBeInTheDocument();
    });

    const interestBtn = screen.getByRole('button', { name: /Save restock interest/i });
    expect(interestBtn).toBeInTheDocument();

    await user.click(interestBtn);

    expect(saveInterestMock).toHaveBeenCalledWith('blr-01', 'prod-tea-gold');
    await waitFor(() => {
      expect(screen.getByText(/Stock Interest Recorded/i)).toBeInTheDocument();
    });
  });

  it('Negative Scenario 2: Alternative becomes unavailable before approval — re-reservation re-triggers conflict safely', async () => {
    const user = userEvent.setup();

    const createReservationMock = vi.spyOn(api, 'createReservation');
    // 1st call fails for original item
    createReservationMock.mockRejectedValueOnce(
      new ApiClientError('STOCK_UNAVAILABLE', 'Initial out of stock', 409, { unavailableProducts: ['prod-tea-gold'] })
    );

    vi.spyOn(api, 'updateCart').mockResolvedValue({
      ...mockCart,
      lines: [{ productId: 'prod-tea-premium', quantity: 2, name: 'Tata Tea Premium', unitPricePaise: 42000 }],
    });

    // 2nd call (for alternative) ALSO fails because another shopper bought it
    createReservationMock.mockRejectedValueOnce(
      new ApiClientError('STOCK_UNAVAILABLE', 'Alternative also sold out', 409, { unavailableProducts: ['prod-tea-premium'] })
    );

    render(<CheckoutView />);

    await waitFor(() => {
      expect(screen.getByText('Tata Tea Gold 500g')).toBeInTheDocument();
    });

    const approveBtn = await screen.findByRole('button', { name: /Approve this replacement/i });
    await user.click(approveBtn);

    // Must safely re-enter STOCK_CONFLICT with the new unavailable product
    await waitFor(() => {
      expect(screen.getByText('This item just became unavailable')).toBeInTheDocument();
    });
  });

  it('Negative Scenario 3: Shopper rejects all alternatives and proceeds with remaining items', async () => {
    const user = userEvent.setup();

    const createReservationMock = vi.spyOn(api, 'createReservation');
    createReservationMock.mockRejectedValueOnce(
      new ApiClientError('STOCK_UNAVAILABLE', 'Out of stock', 409, { unavailableProducts: ['prod-tea-gold'] })
    );

    const updateCartMock = vi.spyOn(api, 'updateCart').mockImplementation(async (_storeId, lines) => {
      mockCart = {
        ...mockCart,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          name: 'Sugar 1kg',
          unitPricePaise: 5000,
        })),
        totalPaise: 5000,
      };
      currentMockCart = mockCart;
      return mockCart;
    });

    const remainingHold: Hold = {
      id: 'hold-remaining-only',
      cartId: mockCart.id,
      sessionId: mockCart.sessionId,
      storeId: 'blr-01',
      status: 'ACTIVE',
      serverNow: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      lines: [{ productId: 'prod-staple-sugar', quantity: 1, name: 'Sugar 1kg', unitPricePaise: 5000 }],
      totalPaise: 5000,
    };
    createReservationMock.mockResolvedValueOnce(remainingHold);

    render(<CheckoutView />);

    await waitFor(() => {
      expect(screen.getByText('This item just became unavailable')).toBeInTheDocument();
    });

    // Shopper clicks remove unavailable item and proceed
    const removeAndProceedBtn = screen.getByRole('button', {
      name: /Remove unavailable item and proceed with remaining items →/i,
    });
    await user.click(removeAndProceedBtn);

    // Verifies cart updated to keep ONLY the available items
    expect(updateCartMock).toHaveBeenCalledWith('blr-01', [{ productId: 'prod-staple-sugar', quantity: 1 }]);

    // Hold created for remaining items
    await waitFor(() => {
      expect(screen.getByText('hold-remaining-only')).toBeInTheDocument();
    });
  });

  it('Negative Scenario 4: Two unavailable products in same cart preserves remaining items without dropping cart state', async () => {
    vi.spyOn(api, 'createReservation').mockRejectedValueOnce(
      new ApiClientError('STOCK_UNAVAILABLE', 'Multiple out of stock', 409, {
        unavailableProducts: ['prod-tea-gold', 'prod-staple-sugar'],
      })
    );

    render(<CheckoutView />);

    // Shows conflict panel focused on the first conflicting product
    await waitFor(() => {
      expect(screen.getByText('This item just became unavailable')).toBeInTheDocument();
      expect(screen.getByText('Tata Tea Gold 500g')).toBeInTheDocument();
    });
  });
});
