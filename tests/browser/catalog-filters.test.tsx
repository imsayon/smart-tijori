// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Catalog } from '@/components/shop/catalog/catalog';
import { api } from '@/lib/api-client';

vi.mock('@/lib/session/store-context', () => ({
  useStore: () => ({ selectedStoreId: 'mys-01' }),
}));
vi.mock('@/lib/api-client', () => ({
  api: { getProducts: vi.fn().mockResolvedValue({ items: [] }) },
}));

it('combines the search text with category, price and stock filters', async () => {
  render(<Catalog initialQuery="Frnt Lod" />);
  fireEvent.click(screen.getByRole('tab', { name: /Household/ }));
  fireEvent.change(screen.getByLabelText('Min price (₹)'), { target: { value: '149' } });
  fireEvent.change(screen.getByLabelText('Max price (₹)'), { target: { value: '249.50' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'In-stock only' }));

  await waitFor(() => expect(api.getProducts).toHaveBeenLastCalledWith({
    storeId: 'mys-01',
    page: 1,
    q: 'Frnt Lod',
    category: 'household',
    minPricePaise: 14900,
    maxPricePaise: 24950,
    includeUnavailable: false,
  }));
  expect(api.getProducts).toHaveBeenCalledTimes(1);
});
