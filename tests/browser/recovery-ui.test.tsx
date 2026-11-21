// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConflictRecoveryPanel } from '@/components/shop/recovery/conflict-recovery-panel';
import { ConstraintEditor } from '@/components/shop/recovery/constraint-editor';
import { api } from '@/lib/api-client';
import * as storeContextModule from '@/lib/session/store-context';
import type { Cart, RecoveryResult, ProductOffer, RecoveryConstraints } from '@/contracts';

describe('Shopper Conflict Recovery UI Tests', () => {
  const mockCart: Cart = {
    id: 'cart-123',
    storeId: 'blr-01',
    lines: [
      {
        productId: 'prod-unavailable-tea',
        name: 'Tata Tea Gold 500g',
        quantity: 2,
        unitPricePaise: 28000,
      },
      {
        productId: 'prod-staple-sugar',
        name: 'Sugar 1kg',
        quantity: 1,
        unitPricePaise: 5000,
      },
    ],
    totalPaise: 61000,
  };

  const mockAlternative: ProductOffer = {
    productId: 'prod-tea-premium',
    storeId: 'blr-01',
    city: 'Bengaluru',
    name: 'Tata Tea Premium 1kg',
    category: 'essentials',
    purpose: 'tea',
    pricePaise: 45000,
    imageUrl: '/images/tea.webp',
    pack: { quantity: 1, unit: 'kg' },
    attributes: { type: 'ctc' },
    available: 10,
    inventoryVersion: 1,
    checkedAt: new Date().toISOString(),
  };

  const sampleAiRecoveryResult: RecoveryResult = {
    mode: 'ai',
    constraints: {
      purpose: 'tea',
      maxPricePaise: 50000,
      minPack: { quantity: 500, unit: 'g' },
    },
    candidates: [
      {
        offer: mockAlternative,
        reasons: [
          'Within stated budget (₹450.00)',
          'Meets minimum package size of 500 g (1 kg)',
          'Currently in stock at Bengaluru branch (10 available)',
        ],
      },
    ],
    checkedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(storeContextModule, 'useStore').mockReturnValue({
      cart: mockCart,
      store: null,
      stores: [],
      isLoading: false,
      isStoreModalOpen: false,
      setStoreModalOpen: vi.fn(),
      selectStore: vi.fn(),
      refreshCart: vi.fn(),
      addToCart: vi.fn(),
      updateLineQuantity: vi.fn(),
      removeLine: vi.fn(),
      clearCart: vi.fn(),
    });
  });

  it('displays unavailable product, preserved constraints, and AI mode badge', async () => {
    vi.spyOn(api, 'getRecovery').mockResolvedValue(sampleAiRecoveryResult);

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['prod-unavailable-tea']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    // Shows unavailable original item details
    expect(await screen.findByText('This item just became unavailable')).toBeInTheDocument();
    expect(screen.getByText('Tata Tea Gold 500g')).toBeInTheDocument();
    expect(screen.getByText(/Qty: 2/)).toBeInTheDocument();

    // Shows AI Verified Match badge
    expect(screen.getByText(/AI Verified Match/i)).toBeInTheDocument();

    // Shows preserved requirements
    expect(screen.getByText(/Purpose:/)).toBeInTheDocument();
    expect(screen.getByText('tea')).toBeInTheDocument();
    expect(screen.getByText(/Budget:/)).toBeInTheDocument();
    expect(screen.getByText(/Min Pack:/)).toBeInTheDocument();

    // Shows alternative card with factual reasons
    expect(screen.getByText('Tata Tea Premium 1kg')).toBeInTheDocument();
    expect(screen.getByText(/Within stated budget/)).toBeInTheDocument();
  });

  it('displays clear rules-mode badge when fallback is used', async () => {
    const rulesResult: RecoveryResult = {
      ...sampleAiRecoveryResult,
      mode: 'rules',
    };
    vi.spyOn(api, 'getRecovery').mockResolvedValue(rulesResult);

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['prod-unavailable-tea']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    expect(await screen.findByText(/Rules Mode \(Fallback\)/i)).toBeInTheDocument();
  });

  it('displays zero-dead-end empty state with preserved constraints when no product matches', async () => {
    const emptyResult: RecoveryResult = {
      mode: 'rules',
      constraints: {
        purpose: 'tea',
        maxPricePaise: 10000,
      },
      candidates: [],
      checkedAt: new Date().toISOString(),
    };
    vi.spyOn(api, 'getRecovery').mockResolvedValue(emptyResult);

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['prod-unavailable-tea']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    expect(
      await screen.findByText(/No exact match found satisfying all hard constraints/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save restock interest/i })).toBeInTheDocument();
  });

  it('allows shopper to edit constraints and triggers recovery update', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    const initialConstraints: RecoveryConstraints = {
      purpose: 'tea',
      maxPricePaise: 30000,
      minPack: { quantity: 500, unit: 'g' },
    };

    render(<ConstraintEditor constraints={initialConstraints} onApply={onApply} />);

    const budgetInput = screen.getByLabelText(/Max Budget/i);
    await user.clear(budgetInput);
    await user.type(budgetInput, '450');

    const updateButton = screen.getByRole('button', { name: /Update alternatives/i });
    await user.click(updateButton);

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        maxPricePaise: 45000,
      }),
      undefined
    );
  });

  it('requires explicit shopper approval to update cart with replacement (never automatic)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getRecovery').mockResolvedValue(sampleAiRecoveryResult);

    const updateCartSpy = vi.spyOn(api, 'updateCart').mockResolvedValue({
      ...mockCart,
      lines: [
        {
          productId: 'prod-tea-premium',
          name: 'Tata Tea Premium 1kg',
          quantity: 2,
          unitPricePaise: 45000,
        },
        mockCart.lines[1],
      ],
    });

    const onApproved = vi.fn();

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['prod-unavailable-tea']}
        onReplacementApproved={onApproved}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    expect(await screen.findByText('Tata Tea Premium 1kg')).toBeInTheDocument();

    // Verify updateCart was NOT called automatically before clicking
    expect(updateCartSpy).not.toHaveBeenCalled();

    // User explicitly clicks approve
    const approveBtn = screen.getByRole('button', { name: /Approve this replacement/i });
    await user.click(approveBtn);

    // Now updateCart is called with replacement replacing unavailable line
    expect(updateCartSpy).toHaveBeenCalledWith('blr-01', [
      { productId: 'prod-staple-sugar', quantity: 1 },
      { productId: 'prod-tea-premium', quantity: 2 },
    ]);

    expect(onApproved).toHaveBeenCalled();
  });

  it('submits natural-language prompt to api.getRecovery only on explicit submit, not on each keystroke', async () => {
    const user = userEvent.setup();
    const getRecoverySpy = vi.spyOn(api, 'getRecovery').mockResolvedValue(sampleAiRecoveryResult);

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['prod-unavailable-tea']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    expect(await screen.findByText('This item just became unavailable')).toBeInTheDocument();
    // Initial mount called getRecovery once
    expect(getRecoverySpy).toHaveBeenCalledTimes(1);

    const input = screen.getByPlaceholderText(/Describe what you're looking for/i);
    await user.type(input, 'organic green tea');

    // Keystrokes must NOT trigger network requests
    expect(getRecoverySpy).toHaveBeenCalledTimes(1);

    // Click explicit submit button
    const searchButton = screen.getByRole('button', { name: /Find alternatives/i });
    await user.click(searchButton);

    // Explicit submission triggers the second request with text
    expect(getRecoverySpy).toHaveBeenCalledTimes(2);
    expect(getRecoverySpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        storeId: 'blr-01',
        unavailableProductId: 'prod-unavailable-tea',
        text: 'organic green tea',
      })
    );
  });

  it('displays accurate verified stock badges and avoids inventing numbers for boolean availability', async () => {
    const candidateNumeric = {
      ...mockAlternative,
      productId: 'prod-numeric-stock',
      name: 'Numeric Stock Tea',
      available: 15,
    };
    const candidateBoolean = {
      ...mockAlternative,
      productId: 'prod-bool-stock',
      name: 'Boolean Stock Tea',
      available: true as unknown as number,
      availableStock: undefined,
    };

    const result: RecoveryResult = {
      mode: 'rules',
      constraints: { purpose: 'tea' },
      candidates: [
        { offer: candidateNumeric, reasons: ['Factual reason 1'] },
        { offer: candidateBoolean, reasons: ['Factual reason 2'] },
      ],
      checkedAt: new Date().toISOString(),
    };

    vi.spyOn(api, 'getRecovery').mockResolvedValue(result);

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['prod-unavailable-tea']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    expect(await screen.findByText('Numeric Stock Tea')).toBeInTheDocument();
    // Numeric stock: 15 in stock
    expect(screen.getByText('15 in stock')).toBeInTheDocument();

    // Boolean stock: In stock (never invented numbers)
    expect(screen.getByText('In stock')).toBeInTheDocument();
  });

  it('renders recoverable error state with retry when recovery request fails', async () => {
    const user = userEvent.setup();
    const getRecoverySpy = vi.spyOn(api, 'getRecovery').mockRejectedValueOnce(new Error('Network error'));

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['prod-unavailable-tea']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    expect(await screen.findByText(/Could not load alternatives/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Try again/i });
    expect(retryBtn).toBeInTheDocument();

    getRecoverySpy.mockResolvedValueOnce(sampleAiRecoveryResult);
    await user.click(retryBtn);

    expect(await screen.findByText('Tata Tea Premium 1kg')).toBeInTheDocument();
  });

  it('renders constraints and updates alternatives when maxPriceMinor and minPackUnits aliases are provided', async () => {
    const user = userEvent.setup();
    const resultWithAliases: RecoveryResult = {
      mode: 'rules',
      constraints: {
        purpose: 'tea',
        maxPricePaise: 40000,
        maxPriceMinor: 40000,
        minPack: { quantity: 1, unit: 'kg' },
        minPackUnits: { quantity: 1, unit: 'kg' },
      },
      candidates: [
        {
          offer: mockAlternative,
          reasons: ['Within budget', 'In stock at branch (10 available)'],
        },
      ],
      checkedAt: new Date().toISOString(),
    };

    const getRecoverySpy = vi.spyOn(api, 'getRecovery').mockResolvedValue(resultWithAliases);

    render(
      <ConflictRecoveryPanel
        storeId="blr-01"
        unavailableProductIds={['prod-unavailable-tea']}
        onReplacementApproved={vi.fn()}
        onKeepCartWithoutUnavailable={vi.fn()}
      />
    );

    // Budget: ₹400 and Min Pack: 1 kg rendered properly
    expect(await screen.findByText(/₹400/)).toBeInTheDocument();
    expect(screen.getAllByText(/1 kg/).length).toBeGreaterThanOrEqual(1);

    // Constraint editor should initialize with 400
    const budgetInput = screen.getByLabelText(/Max Budget/i) as HTMLInputElement;
    expect(budgetInput.value).toBe('400');

    // Update budget to 500
    await user.clear(budgetInput);
    await user.type(budgetInput, '500');
    const updateBtn = screen.getByRole('button', { name: /Update alternatives/i });
    await user.click(updateBtn);

    expect(getRecoverySpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        explicitConstraints: expect.objectContaining({
          maxPricePaise: 50000,
          maxPriceMinor: 50000,
        }),
      })
    );
  });
});
