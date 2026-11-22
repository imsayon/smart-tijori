import { CheckoutGate } from '@/components/shop/checkout/checkout-gate';

/**
 * Checkout UI preview while ordering/settlement is being built.
 * No stock is reserved and no order is confirmed on this route.
 */
export default function CheckoutPage() {
  return <CheckoutGate />;
}
