// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductCard } from '@/components/shop/product/product-card';
import { CartLineItem } from '@/components/shop/cart/cart-line-item';
import { MOCK_OFFER } from '../fixtures/mock-data';

// Mock store context
const mockAddToCart = vi.fn();
const mockUpdateCartQuantity = vi.fn();
const mockRemoveFromCart = vi.fn();

vi.mock('@/lib/session/store-context', () => ({
  useStore: () => ({
    selectedStoreId: 'blr-01',
    selectedStore: { id: 'blr-01', name: 'SmartTijori Bengaluru', city: 'Bengaluru' },
    cart: {
      id: 'cart-1',
      sessionId: 'session-1',
      storeId: 'blr-01',
      lines: [],
      totalPaise: 0,
    },
    cartItemCount: 0,
    isLoading: false,
    addToCart: mockAddToCart,
    updateCartQuantity: mockUpdateCartQuantity,
    removeFromCart: mockRemoveFromCart,
  }),
}));

describe('Shopping Flow Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders product card with server-verified price and pack information', () => {
    render(<ProductCard offer={MOCK_OFFER} />);

    expect(screen.getByText(MOCK_OFFER.name)).toBeInTheDocument();
    expect(screen.getByText(/₹229/)).toBeInTheDocument();
    expect(screen.getByText('1000 ml')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Add to cart/i })).toBeInTheDocument();
  });

  it('clicking Add to Cart triggers addToCart callback without page navigation', async () => {
    const user = userEvent.setup();
    render(<ProductCard offer={MOCK_OFFER} />);

    const addButton = screen.getByRole('button', { name: /\+ Add to cart/i });
    await user.click(addButton);

    expect(mockAddToCart).toHaveBeenCalledWith(MOCK_OFFER, 1);
  });

  it('CartLineItem allows quantity increment, decrement, and removal', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();

    const line = {
      productId: 'blr-basmati-1kg',
      quantity: 2,
      name: 'Premium Basmati Rice',
      unitPricePaise: 18500,
    };

    render(
      <CartLineItem
        line={line}
        onUpdateQuantity={onUpdate}
        onRemove={onRemove}
      />
    );

    // Verify subtotal 18500 * 2 = 37000 paise (₹370)
    expect(screen.getByText(/₹370/)).toBeInTheDocument();

    const incButton = screen.getByLabelText(/Increase quantity/i);
    await user.click(incButton);
    expect(onUpdate).toHaveBeenCalledWith(3);

    const decButton = screen.getByLabelText(/Decrease quantity/i);
    await user.click(decButton);
    expect(onUpdate).toHaveBeenCalledWith(1);

    const removeButton = screen.getByLabelText(/Remove/i);
    await user.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
