import Link from 'next/link';
import { cookies } from 'next/headers';
import { CheckoutView } from '@/components/shop/checkout/checkout-view';
import { createCommerceCommands } from '@server/commerce/commands';
import { getCommerceDatabase } from '@server/db/runtime';
import { readAccount, shopperId } from '@server/http/auth/firebase-session';
import { paymentConfig } from '@server/payments/razorpay';

export default async function CheckoutPage() {
  const fixture = process.env.SMARTTIJORI_DEMO_MODE === 'true';
  if (fixture) return <CheckoutView />;

  const user = await readAccount((await cookies()).toString());
  if (!user) return <section className="space-y-4">
    <h1 className="atelier-heading text-5xl">Checkout</h1>
    <p>Sign in to pay and track your order. Your bag is saved on this device.</p>
    <Link href="/account?next=checkout" className="atelier-action">Sign in</Link>
  </section>;
  const config = paymentConfig();
  if (!config) return <section className="space-y-4">
    <h1 className="atelier-heading text-5xl">Checkout</h1>
    <p>Online payments are currently unavailable. Your bag is saved.</p>
    <Link href="/cart" className="atelier-action">Return to bag</Link>
  </section>;
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
