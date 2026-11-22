// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CartView } from '@/components/shop/cart/cart-view';
import { AccountOverview } from '@/components/account/account-overview';
import { CheckoutGate } from '@/components/shop/checkout/checkout-gate';
import { CartLockDial } from '@/components/shop/checkout/cartlock-dial';

const sampleCart = {
  id: 'cart-01', sessionId: 'shopper-01', storeId: 'dm-tam-ath-kr',
  lines: [
    { productId: 'atta-01', name: 'Aashirvaad Shudh Chakki Atta, 5 kg', quantity: 1, unitPricePaise: 29500 },
    { productId: 'rice-02', name: 'Joha Aromatic Rice', quantity: 2, unitPricePaise: 9000 },
  ],
  totalPaise: 47500,
};
const updateCartQuantity = vi.fn();
const removeFromCart = vi.fn();
vi.mock('@/lib/session/store-context', () => ({
  useStore: () => ({
    cart: sampleCart, selectedStore: { id: sampleCart.storeId, name: 'Athangudi Village Provision Store', city: 'Tamil Nadu' },
    isLoading: false, updateCartQuantity, removeFromCart,
  }),
}));

describe('Editorial commerce journey', () => {
  it('renders real bag quantities and a clearly not-yet-started CartLock preview', () => {
    const { container } = render(<CartView />);
    expect(screen.getByText('Aashirvaad Shudh Chakki Atta, 5 kg')).toBeInTheDocument();
    expect(screen.getByText('Joha Aromatic Rice')).toBeInTheDocument();
    expect(screen.getByText(/THE CLOCK STARTS AT CHECKOUT, NOT HERE/)).toBeInTheDocument();
    expect(container.querySelector('.st-dial[data-mode="preview"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Continue to checkout/i })).toHaveAttribute('href', '/checkout');
    expect(screen.getByText('₹475')).toBeInTheDocument();
  });

  it('uses branch and cart context on the profile without inventing an order count', () => {
    render(<AccountOverview email="sample@example.test" />);
    expect(screen.getAllByText('sample@example.test').length).toBeGreaterThan(0);
    expect(screen.getByText('Athangudi Village Provision Store')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View order history/i })).toHaveAttribute('href', '/orders');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('distinguishes an unstarted preview from a live hold presentation', () => {
    const { container, rerender } = render(<CartLockDial mode="preview" />);
    expect(container.querySelector('[data-mode="preview"]')).toBeTruthy();
    expect(screen.getByText('UPON CHECKOUT')).toBeInTheDocument();
    rerender(<CartLockDial mode="active" seconds={14}/>);
    expect(container.querySelector('[data-mode="active"]')).toBeTruthy();
    expect(screen.getByText('00:14')).toBeInTheDocument();
    expect(screen.getByText('RESERVED FOR')).toBeInTheDocument();
  });

  it('keeps auth and payment unavailable gates actionable without claiming a reservation', () => {
    const { rerender } = render(<CheckoutGate reason="signin" />);
    expect(screen.getByRole('link', { name: /Sign in to continue/i })).toHaveAttribute('href', '/account?next=checkout');
    rerender(<CheckoutGate reason="payment" />);
    expect(screen.getByText(/nothing has been charged/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to your bag/i })).toHaveAttribute('href', '/cart');
  });
});
