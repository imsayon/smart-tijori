import Link from 'next/link';
import { cookies } from 'next/headers';
import { CheckoutView } from '@/components/shop/checkout/checkout-view';
import { createCommerceCommands } from '@server/commerce/commands';
import { getCommerceDatabase } from '@server/db/runtime';
import { readAccount, shopperId } from '@server/http/auth/email-session';
import { paymentConfig } from '@server/payments/razorpay';
import { CartLockPreview, PurchaseTrail } from '@/components/shop/atelier/purchase-details';

function CheckoutGate({ reason }: { reason: 'sign-in' | 'unavailable' }) {
  const signin = reason === 'sign-in';
  return <section className="st-purchase-page st-checkout-page">
    <header className="st-purchase-heading">
      <div className="st-purchase-heading-copy">
        <p className="st-overline"><span className="st-mini-dot"/> CARTLOCK / CHECKOUT</p>
        <h1 className="atelier-heading">{signin ? 'Your next step.' : 'Nearly there.'} <em>{signin ? 'Your way.' : 'Not quite yet.'}</em></h1>
        <p>{signin ? 'Sign in to continue from your saved bag and track your order.' : 'Online payments are currently unavailable. Your bag is saved and you can continue browsing.'}</p>
      </div>
    </header>
    <PurchaseTrail current={2}/>
    <div className="st-checkout-gate">
      <div className="st-checkout-gate-message">
        <p className="st-overline">{signin ? 'YOUR ACCOUNT / SECURE CHECKOUT' : 'CHECKOUT / TEMPORARILY UNAVAILABLE'}</p>
        <h2>{signin ? 'Keep your favourites close.' : 'Your bag can wait.'}</h2>
        <p>{signin ? 'Your picks are still here. Sign in, then we will check live stock before creating any hold.' : 'We have not held any stock or charged you. Return to your bag while checkout is unavailable.'}</p>
        <div className="st-checkout-gate-actions">
          <Link className="st-button-primary" href={signin ? '/account?next=checkout' : '/cart'}>
            {signin ? 'Sign in to continue' : 'Return to bag'} <span aria-hidden="true">↗</span>
          </Link>
          <Link className="st-quiet-link" href={signin ? '/cart' : '/search'}>{signin ? 'Review bag' : 'Explore products'}</Link>
        </div>
      </div>
      <CartLockPreview compact/>
    </div>
  </section>;
}

export default async function CheckoutPage() {
  const fixture = process.env.SMARTTIJORI_DEMO_MODE === 'true';
  if (fixture) return <CheckoutView />;

  const user = await readAccount((await cookies()).toString());
  if (!user) return <CheckoutGate reason="sign-in"/>;
  const config = paymentConfig();
  if (!config) return <CheckoutGate reason="unavailable"/>;
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
