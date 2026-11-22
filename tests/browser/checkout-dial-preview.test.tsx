// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { CheckoutGate } from '@/components/shop/checkout/checkout-gate';

afterEach(() => vi.useRealTimers());

describe('Checkout visual 59-second QR sequence', () => {
  it('starts at 00:59, reaches 00:00, then flips into a QR without changing the cart', () => {
    vi.useFakeTimers();
    render(<CheckoutGate />);
    expect(screen.getByText('00:59')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Demo QR opening/i })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText('00:49')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(49_000));

    const qr = screen.getByRole('img', { name: /Demo QR opening/i });
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(qr.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(100);
    expect(screen.getByText(/No order or stock reserved/)).toBeInTheDocument();
    expect(screen.queryByText('00:59')).not.toBeInTheDocument();
  });

  it('contains no transaction claims or QR handover authorization', () => {
    vi.useFakeTimers();
    render(<CheckoutGate />);
    expect(screen.getByText(/This is a demonstration only/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to your bag/i })).toHaveAttribute('href', '/cart');
  });
});
