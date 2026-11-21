// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlternativeCard } from '@/components/shop/recovery/alternative-card';
import { SimulatedPaymentReceipt } from '@/components/shop/checkout/simulated-payment-receipt';
import { MOCK_OFFER } from '../fixtures/mock-data';
import type { RecoveryCandidate, Order } from '@/contracts';

describe('Checkout Conflict, Recovery & Receipt UX Tests', () => {
  it('AlternativeCard displays verified factual reasons and requires explicit shopper approval', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();

    const candidate: RecoveryCandidate = {
      offer: {
        ...MOCK_OFFER,
        productId: 'blr-detergent-powder-1kg',
        name: 'Detergent Powder (Regular)',
        pricePaise: 9900,
      },
      reasons: [
        '₹130 lower price than original item',
        'Identical pack size (1000 g)',
        'Currently in stock at Bengaluru branch (50 available)',
      ],
    };

    render(
      <AlternativeCard
        candidate={candidate}
        unavailableOffer={MOCK_OFFER}
        onApprove={onApprove}
      />
    );

    expect(screen.getByText('Detergent Powder (Regular)')).toBeInTheDocument();
    expect(screen.getByText(/₹99/)).toBeInTheDocument();
    expect(screen.getByText(/₹130 lower price than original item/)).toBeInTheDocument();
    expect(screen.getByText(/Identical pack size/)).toBeInTheDocument();

    const approveButton = screen.getByRole('button', { name: /Approve this replacement/i });
    await user.click(approveButton);

    expect(onApprove).toHaveBeenCalledWith(candidate.offer);
  });

  it('SimulatedPaymentReceipt clearly labels simulated payment mode per Master Plan requirement', () => {
    const mockOrder: Order = {
      id: 'order-rec-999',
      reservationId: 'hold-rec-999',
      storeId: 'blr-01',
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      lines: [
        {
          productId: 'blr-basmati-1kg',
          name: 'Premium Basmati Rice',
          quantity: 2,
          unitPricePaise: 18500,
        },
      ],
      totalPaise: 37000,
      paymentMode: 'SIMULATED',
    };

    render(<SimulatedPaymentReceipt order={mockOrder} />);

    expect(screen.getByText('Order Confirmed!')).toBeInTheDocument();
    expect(screen.getByText(/SIMULATED PAYMENT/)).toBeInTheDocument();
    expect(screen.getByText(/Mode: SIMULATED/)).toBeInTheDocument();
    expect(screen.getByText('order-rec-999')).toBeInTheDocument();
    expect(screen.getAllByText(/₹370/).length).toBeGreaterThan(0);
  });
});
