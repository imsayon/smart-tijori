// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StoresPage from '@/app/(shop)/stores/page';
import { StoreModal } from '@/components/shop/store-selector/store-modal';

const selectStore = vi.fn();
const shops = [
  { id: 'dm-blr-01', name: 'Demo · Jayanagar Kirana', city: 'Bengaluru' },
  { id: 'dm-guw-01', name: 'Demo · Fancy Bazaar Grocery Shop', city: 'Guwahati' },
  { id: 'dm-sil-01', name: 'Demo · Bidhan Market Spice Shop', city: 'Siliguri' },
];
vi.mock('@/lib/session/store-context', () => ({
  useStore: () => ({
    availableStores: shops,
    selectedStoreId: 'dm-blr-01',
    selectStore,
  }),
}));

describe('India-wide branch discovery', () => {
  it('filters dynamically generated cities and selects a branch', () => {
    render(<StoresPage />);
    expect(screen.getByRole('option', { name: 'Siliguri' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Guwahati' } });
    expect(screen.getByText('Demo · Fancy Bazaar Grocery Shop')).toBeInTheDocument();
    expect(screen.queryByText('Demo · Jayanagar Kirana')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fancy Bazaar Grocery Shop/ }));
    expect(selectStore).toHaveBeenCalledWith(shops[1]);
  });

  it('searches markets beyond Bengaluru and Mysuru in the modal', () => {
    const onClose = vi.fn();
    render(<StoreModal isOpen onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Find a shop, city or neighbourhood'), {
      target: { value: 'Bidhan' },
    });
    expect(screen.getByText('Demo · Bidhan Market Spice Shop')).toBeInTheDocument();
    expect(screen.queryByText('Demo · Jayanagar Kirana')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Bidhan Market Spice Shop/ }));
    expect(selectStore).toHaveBeenCalledWith(shops[2]);
    expect(onClose).toHaveBeenCalled();
  });
});
