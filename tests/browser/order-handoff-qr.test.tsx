// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QrCode } from '@/components/ui/qr-code';
import { chooseProductPhoto } from '@/lib/catalog/representative-photography';
import { SimulatedPaymentReceipt } from '@/components/shop/checkout/simulated-payment-receipt';

const sampleOrder = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  reservationId: 'r-test-1',
  storeId: 'blr-01',
  createdAt: '2026-11-22T07:12:00+05:30',
  status: 'CONFIRMED' as const,
  lines: [{ productId: 'demo-tomato-500g', name: 'Tomatoes', quantity: 1, unitPricePaise: 3000 }],
  totalPaise: 3000,
  paymentMode: 'SIMULATED' as const,
};

describe('Privacy-preserving order handoff', () => {
  it('renders an actual encoded QR symbol locally instead of an external image', () => {
    const value = `https://smart-tijori.onrender.com/ops/verify/${sampleOrder.id}`;
    render(<QrCode value={value} label="Authorized branch order verifier" />);
    const qr = screen.getByRole('img', { name: 'Authorized branch order verifier' });
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(qr.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(200);
    expect(qr.querySelector('image')).toBeNull();
  });

  it('only displays a staff-verification QR on a confirmed receipt', () => {
    render(<SimulatedPaymentReceipt order={sampleOrder} />);
    expect(screen.getByRole('img', { name: /QR code to verify confirmed order/ })).toBeInTheDocument();
    expect(screen.getByText(/STAFF SIGN-IN REQUIRED/)).toBeInTheDocument();
    expect(screen.getByText(/does not mark the goods handed over/i)).toBeInTheDocument();
  });
});

describe('Real photo fallback', () => {
  const offer = { productId: 'demo-tomato-500g', name: 'Fresh Tomatoes', purpose: 'fresh-vegetable', imageUrl: '' };
  it('prefers the brand or merchant photo provided by the database', () => {
    expect(chooseProductPhoto({ ...offer, imageUrl: 'https://shop.example.org/product.jpg' }))
      .toMatchObject({ url: 'https://shop.example.org/product.jpg', representative: false });
  });
  it('maps a popular grocery item to a real Wikimedia photo', () => {
    expect(chooseProductPhoto(offer)).toMatchObject({
      representative: true, sourceFile: 'Vegetable_tomatoes.jpg',
    });
  });
  it('does not invent imagery for unrelated or unsafe URLs', () => {
    expect(chooseProductPhoto({productId: 'not-mapped', name: 'Unidentified Gift', purpose: 'unknown', imageUrl: 'javascript:alert(1)'})).toBeNull();
  });
});
