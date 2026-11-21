// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert } from '@/components/shop/feedback/alert';
import { StockBadge } from '@/components/shop/product/stock-badge';
import { HoldTimer } from '@/components/shop/checkout/hold-timer';
import { BranchCard } from '@/components/shop/store-selector/branch-card';
import { MOCK_STORES } from '../fixtures/mock-data';

describe('Accessibility & UI Controls Tests', () => {
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
});
