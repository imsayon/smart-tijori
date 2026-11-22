// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GreenAtelierLanding } from '@/components/shop/atelier/green-atelier-landing';

const openStoreModal = vi.fn();
vi.mock('@/lib/session/store-context', () => ({
  useStore: () => ({
    selectedStoreId: '',
    selectedStore: null,
    isLoading: false,
    openStoreModal,
  }),
}));
vi.mock('@/lib/api-client', () => ({
  api: { getProducts: vi.fn() },
}));

describe('Green Atelier long-scroll storefront', () => {
  it('renders every narrative chapter in order without claiming live simulation data', () => {
    render(<GreenAtelierLanding />);
    const chapters = [
      'Better things.',
      'Good finds,',
      'Two places to shop.',
      'One item.',
      'At your fingertips.',
      '59 seconds.',
      'Not in stock?',
      'Your neighbourhood,',
    ];
    const headings = screen.getAllByRole('heading').map(element => element.textContent || '');
    const indices = chapters.map(chapter => headings.findIndex(text => text.includes(chapter)));
    expect(indices.every(index => index >= 0)).toBe(true);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(screen.getByText(/NOT A LIVE STOCK COUNTER/)).toBeInTheDocument();
    expect(screen.getByText(/NOT A LIVE RESERVATION COUNTDOWN/)).toBeInTheDocument();
  });

  it('allows customers to inspect the illustrative allocation sequence', () => {
    render(<GreenAtelierLanding />);
    fireEvent.click(screen.getByRole('tab', { name: /02 · Online hold/ }));
    expect(screen.getByText('Checkout reserves the final unit.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /03 · POS attempts/ }));
    expect(screen.getByText('The counter cannot sell a held unit.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /03 · POS attempts/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the real branch selector from the editorial CTA', () => {
    render(<GreenAtelierLanding />);
    fireEvent.click(screen.getByRole('button', { name: /Find your store/ }));
    expect(openStoreModal).toHaveBeenCalledTimes(1);
  });
});
