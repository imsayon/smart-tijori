// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConflictRecoveryPanel } from '@/components/shop/recovery/conflict-recovery-panel';
import { api } from '@/lib/api-client';
import type { Cart, RecoveryResult } from '@/contracts';

const mockCartWithMultiConflicts: Cart = {
  id: 'cart-multi-123',
  sessionId: 'session-multi-123',
  storeId: 'blr-01',
  lines: [
    {
      productId: 'blr-milk-1l',
      quantity: 3,
      name: 'Fresh Whole Milk',
      unitPricePaise: 6500,
    },
    {
      productId: 'blr-basmati-1kg',
      quantity: 2,
      name: 'Premium Basmati Rice',
      unitPricePaise: 18500,
    },
    {
      productId: 'blr-atta-5kg',
      quantity: 1,
      name: 'Whole Wheat Sharbati Atta',
      unitPricePaise: 29000,
    },
  ],
  totalPaise: 85500,
};

vi.mock('@/lib/session/store-context', () => ({
  useStore: () => ({
    cart: mockCartWithMultiConflicts,
  }),
}));

vi.mock('@/lib/api-client', () => ({
  api: {
    getRecovery: vi.fn(),
    updateCart: vi.fn(),
    saveInterest: vi.fn(),
  },
}));

describe('Multi-Item Stock Conflict Recovery Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockBasmatiRecovery: RecoveryResult = {
    mode: 'rules',
    constraints: { maxPricePaise: 20000 },
    candidates: [
      {
        offer: {
          productId: 'blr-sonamasuri-1kg',
          storeId: 'blr-01',
          name: 'Sonamasuri Rice 1kg',
          pricePaise: 16000,
          category: 'pantry',
          unit: '1000 g',
          pack: { quantity: 1000, unit: 'g' },
          available: 20,
          checkedAt: new Date().toISOString(),
        },
        reasons: ['₹25 lower price', 'In stock at Bengaluru branch'],
      },
    ],
    unavailableOffer: {
      productId: 'blr-basmati-1kg',
      storeId: 'blr-01',
      name: 'Premium Basmati Rice',
      pricePaise: 18500,
      category: 'pantry',
      unit: '1000 g',
      pack: { quantity: 1000, unit: 'g' },
      available: 0,
      checkedAt: new Date().toISOString(),
    },
  };

  const mockAttaRecovery: RecoveryResult = {
    mode: 'rules',
    constraints: { maxPricePaise: 30000 },
    candidates: [
      {
        offer: {
          productId: 'blr-chakki-atta-5kg',
          storeId: 'blr-01',
          name: 'Chakki Fresh Atta 5kg',
          pricePaise: 27500,
          category: 'pantry',
          unit: '5000 g',
          pack: { quantity: 5000, unit: 'g' },
          available: 15,
          checkedAt: new Date().toISOString(),
        },
        reasons: ['₹15 lower price', 'Same 5kg pack size'],
      },
    ],
    unavailableOffer: {
      productId: 'blr-atta-5kg',
      storeId: 'blr-01',
      name: 'Whole Wheat Sharbati Atta',
      pricePaise: 29000,
      category: 'pantry',
      unit: '5000 g',
      pack: { quantity: 5000, unit: 'g' },
      available: 0,
      checkedAt: new Date().toISOString(),
    },
  };

  it('clearly presents every unavailable product returned in the conflict response', async () => {
    vi.mocked(api.getRecovery).mockResolvedValue(mockBasmatiRecovery);

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['blr-basmati-1kg', 'blr-atta-5kg']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    // Both conflicting items must be visible to the shopper
    expect(screen.getByText(/Items in your cart became unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Unavailable Items Requiring Resolution \(2\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Premium Basmati Rice/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Whole Wheat Sharbati Atta/i).length).toBeGreaterThanOrEqual(1);

    // Default active item is the first one
    expect(await screen.findByText('Reviewing Alternatives')).toBeInTheDocument();
    expect(screen.getByText('Select to Replace')).toBeInTheDocument();
  });

  it('resolving one conflict by choosing an alternative retains the other conflicting item and preserves unaffected items', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getRecovery)
      .mockResolvedValueOnce(mockBasmatiRecovery)
      .mockResolvedValueOnce(mockAttaRecovery);

    const onReplacementApproved = vi.fn();
    const updatedCartAfterFirstResolved: Cart = {
      ...mockCartWithMultiConflicts,
      lines: [
        {
          productId: 'blr-milk-1l',
          quantity: 3,
          name: 'Fresh Whole Milk',
          unitPricePaise: 6500,
        },
        {
          productId: 'blr-sonamasuri-1kg',
          quantity: 2,
          name: 'Sonamasuri Rice 1kg',
          unitPricePaise: 16000,
        },
        {
          productId: 'blr-atta-5kg',
          quantity: 1,
          name: 'Whole Wheat Sharbati Atta',
          unitPricePaise: 29000,
        },
      ],
    };

    vi.mocked(api.updateCart).mockResolvedValue(updatedCartAfterFirstResolved);

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['blr-basmati-1kg', 'blr-atta-5kg']}
        onReplacementApproved={onReplacementApproved}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    // Wait for initial alternatives for Basmati Rice to load
    const approveButton = await screen.findByRole('button', { name: /Approve this replacement/i });
    await user.click(approveButton);

    // Verify updateCart was called with:
    // 1. Unaffected Milk (preserved!)
    // 2. Atta (retained!)
    // 3. Basmati replaced by Sonamasuri with original quantity 2
    expect(api.updateCart).toHaveBeenCalledTimes(1);
    expect(api.updateCart).toHaveBeenCalledWith('blr-01', [
      { productId: 'blr-milk-1l', quantity: 3 },
      { productId: 'blr-atta-5kg', quantity: 1 },
      { productId: 'blr-sonamasuri-1kg', quantity: 2 },
    ]);

    // onReplacementApproved should NOT have been called yet because Atta is still unresolved!
    expect(onReplacementApproved).not.toHaveBeenCalled();

    // After resolving Basmati, Atta becomes the active item requiring resolution
    expect(screen.getByText(/Whole Wheat Sharbati Atta/i)).toBeInTheDocument();
  });

  it('resolving one conflict by explicit removal preserves other conflicting items and unaffected cart items', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getRecovery).mockResolvedValue(mockBasmatiRecovery);

    const onReplacementApproved = vi.fn();
    const updatedCartAfterRemoveBasmati: Cart = {
      ...mockCartWithMultiConflicts,
      lines: [
        {
          productId: 'blr-milk-1l',
          quantity: 3,
          name: 'Fresh Whole Milk',
          unitPricePaise: 6500,
        },
        {
          productId: 'blr-atta-5kg',
          quantity: 1,
          name: 'Whole Wheat Sharbati Atta',
          unitPricePaise: 29000,
        },
      ],
    };

    vi.mocked(api.updateCart).mockResolvedValue(updatedCartAfterRemoveBasmati);

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['blr-basmati-1kg', 'blr-atta-5kg']}
        onReplacementApproved={onReplacementApproved}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    await screen.findAllByText(/Premium Basmati Rice/i);

    // Click "Remove from cart" for Basmati Rice
    const removeButtons = screen.getAllByRole('button', { name: /Remove from cart/i });
    // First remove button is for Basmati Rice
    await user.click(removeButtons[0]);

    // Proves Basmati was removed while Milk and Atta were preserved
    expect(api.updateCart).toHaveBeenCalledWith('blr-01', [
      { productId: 'blr-milk-1l', quantity: 3 },
      { productId: 'blr-atta-5kg', quantity: 1 },
    ]);

    // Still not finalized because Atta is still conflicting
    expect(onReplacementApproved).not.toHaveBeenCalled();
  });

  it('resolving all conflicts allows checkout to proceed with all unaffected items preserved', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getRecovery)
      .mockResolvedValueOnce(mockBasmatiRecovery)
      .mockResolvedValueOnce(mockAttaRecovery);

    const onReplacementApproved = vi.fn();
    const finalCart: Cart = {
      ...mockCartWithMultiConflicts,
      lines: [
        {
          productId: 'blr-milk-1l',
          quantity: 3,
          name: 'Fresh Whole Milk',
          unitPricePaise: 6500,
        },
        {
          productId: 'blr-sonamasuri-1kg',
          quantity: 2,
          name: 'Sonamasuri Rice 1kg',
          unitPricePaise: 16000,
        },
        {
          productId: 'blr-chakki-atta-5kg',
          quantity: 1,
          name: 'Chakki Fresh Atta 5kg',
          unitPricePaise: 27500,
        },
      ],
    };

    vi.mocked(api.updateCart).mockResolvedValue(finalCart);

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['blr-basmati-1kg', 'blr-atta-5kg']}
        onReplacementApproved={onReplacementApproved}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    // 1. Approve replacement for Basmati
    const approveBasmatiBtn = await screen.findByRole('button', { name: /Approve this replacement/i });
    await user.click(approveBasmatiBtn);

    // 2. Now Atta is active; wait for its candidate and approve replacement for Atta
    await screen.findByText('Chakki Fresh Atta 5kg');
    const approveAttaBtn = await screen.findByRole('button', { name: /Approve this replacement/i });
    await user.click(approveAttaBtn);

    // When the final conflict is resolved, onReplacementApproved is called with the resolved cart!
    expect(onReplacementApproved).toHaveBeenCalledTimes(1);
    expect(onReplacementApproved).toHaveBeenCalledWith(finalCart);
  });

  it('safely handles zero unavailable products without crashing', () => {
    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={[]}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    expect(screen.getByText(/No stock conflicts/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to Checkout →/i })).toBeInTheDocument();
  });

  it('displays accurate original-price comparison on alternative cards', async () => {
    vi.mocked(api.getRecovery).mockResolvedValue(mockBasmatiRecovery);

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['blr-basmati-1kg']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    // Candidate price
    expect(await screen.findByText('₹160')).toBeInTheDocument();

    // Original price comparison: Basmati rice is ₹185 (18500 paise)
    expect(screen.getByText('(vs ₹185)')).toBeInTheDocument();
  });

  it('safely omits original price comparison when original price data is missing without misleading output', async () => {
    // Recovery response with no unavailableOffer
    const recoveryWithoutOriginalOffer: RecoveryResult = {
      mode: 'rules',
      constraints: { maxPricePaise: 20000 },
      candidates: [
        {
          offer: {
            productId: 'blr-sonamasuri-1kg',
            storeId: 'blr-01',
            name: 'Sonamasuri Rice 1kg',
            pricePaise: 16000,
            category: 'pantry',
            unit: '1000 g',
            pack: { quantity: 1000, unit: 'g' },
            available: 20,
            checkedAt: new Date().toISOString(),
          },
          reasons: ['In stock at Bengaluru branch'],
        },
      ],
      checkedAt: new Date().toISOString(),
    };

    vi.mocked(api.getRecovery).mockResolvedValue(recoveryWithoutOriginalOffer);

    // Product not in cart lines (so no cart price either)
    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['blr-unknown-item']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    // Candidate price is displayed cleanly
    expect(await screen.findByText('₹160')).toBeInTheDocument();

    // No "(vs ...)" text or fabricated comparison is rendered
    expect(screen.queryByText(/\(vs/i)).not.toBeInTheDocument();
  });

  it('switching from one unavailable product to another updates the budget input to the new product constraints', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getRecovery)
      .mockResolvedValueOnce(mockBasmatiRecovery) // constraints.maxPricePaise: 20000 -> 200
      .mockResolvedValueOnce(mockAttaRecovery); // constraints.maxPricePaise: 30000 -> 300

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['blr-basmati-1kg', 'blr-atta-5kg']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    // Initial item is Basmati (ceiling 200)
    const budgetInput = await screen.findByLabelText(/Maximum price/i);
    expect(budgetInput).toHaveValue(200);

    // Switch active item to Atta by clicking "Select to Replace"
    const selectAttaBtn = screen.getByRole('button', { name: /Select to Replace/i });
    await user.click(selectAttaBtn);

    // After switching, the input updates to Atta's constraint (ceiling 300) due to key={activeUnavailableId}
    await waitFor(() => {
      expect(screen.getByLabelText(/Maximum price/i)).toHaveValue(300);
    });
  });

  it('re-rendering while the same product remains active does not reset an in-progress budget edit', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getRecovery).mockResolvedValue(mockBasmatiRecovery);

    const { rerender } = render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['blr-basmati-1kg', 'blr-atta-5kg']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    const budgetInput = await screen.findByLabelText(/Maximum price/i);
    expect(budgetInput).toHaveValue(200);

    // Shopper types a custom in-progress budget edit
    await user.clear(budgetInput);
    await user.type(budgetInput, '245.50');
    expect(budgetInput).toHaveValue(245.5);

    // Re-render panel with same active product (e.g. parent state change, new callbacks)
    rerender(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['blr-basmati-1kg', 'blr-atta-5kg']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    // Input retains the shopper's in-progress edit and is NOT reset
    expect(screen.getByLabelText(/Maximum price/i)).toHaveValue(245.5);
  });
});
