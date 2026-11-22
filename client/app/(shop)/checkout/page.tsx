import { cookies } from 'next/headers';
import { CheckoutView } from '@/components/shop/checkout/checkout-view';
import { CheckoutGate } from '@/components/shop/checkout/checkout-gate';
import { createCommerceCommands } from '@server/commerce/commands';
import { getCommerceDatabase } from '@server/db/runtime';
import { readAccount, shopperId } from '@server/http/auth/email-session';
import { paymentConfig } from '@server/payments/razorpay';

export default async function CheckoutPage() {
  const fixture = process.env.SMARTTIJORI_DEMO_MODE === 'true';
  if (fixture) return <CheckoutView />;

  const user = await readAccount((await cookies()).toString());
  if (!user) return <CheckoutGate reason="signin"/>;
  const config = paymentConfig();
  if (!config) return <CheckoutGate reason="payment"/>;
  const db = getCommerceDatabase();
  const owner = shopperId(user.uid);
  const { rows: [current] } = await db.transact(client => client.query<{ id: string }>(`
    SELECT r.id FROM reservations r JOIN carts c ON c.id = r.cart_id
    WHERE c.owner_id = $1 AND r.status = 'ACTIVE' AND r.expires_at > clock_timestamp()
    LIMIT 1`, [owner]));
  const hold = current ? await createCommerceCommands(db).getHold({ kind: 'shopper', id: owner }, current.id) : null;
  const initialHold = hold?.ok && hold.value.status === 'ACTIVE' ? hold.value : undefined;
  return <CheckoutView online={{ testMode: config.keyId.startsWith('rzp_test_') }} initialHold={initialHold} />;
}
