'use client';

import Link from 'next/link';
import type { Cart } from '@/contracts';
import { useStore } from '@/lib/session/store-context';
import { formatPaise } from '@/lib/utils/currency';
import { Icon } from '@/components/ui/atelier';

/**
 * The dial on the BAG page is a preview of the checkout window.
 * It is intentionally NOT a running countdown: a cart does not reserve inventory.
 * Real deadline-driven timers are rendered by HoldTimer after a successful hold.
 */
export function CartLockPreview({ compact = false }: { compact?: boolean }) {
  return <div className={`st-preflight-lock ${compact ? 'st-preflight-lock-compact' : ''}`}>
    <div className="st-preflight-dial" aria-hidden="true">
      <svg viewBox="0 0 240 240" className="st-preflight-orbit" fill="none">
        <circle cx="120" cy="120" r="93" stroke="currentColor" strokeOpacity=".17" />
        <circle cx="120" cy="120" r="74" stroke="currentColor" strokeOpacity=".24" strokeDasharray="2 8"/>
        <circle cx="120" cy="120" r="105" stroke="currentColor" strokeOpacity=".48" strokeDasharray="1 9" strokeWidth="8"/>
        <path d="M120 15a105 105 0 0 1 105 105" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="120" cy="15" r="4.5" fill="#d7eb9a" />
      </svg>
      <div className="st-preflight-dial-center">
        <span className="st-timer-number">00:59</span>
        <span className="st-preflight-dial-note">AT CHECKOUT</span>
      </div>
    </div>
    <div className="st-preflight-copy">
      <p className="st-overline">CARTLOCK / 01</p>
      <h3>Make your minute <em>count.</em></h3>
      <p>When you begin checkout, we attempt to reserve your entire bag for 59 seconds. Until then, items remain available to other shoppers.</p>
      <span className="st-preflight-foot"><span className="st-mini-dot"/> Your bag is saved. Stock is not yet held.</span>
    </div>
  </div>;
}

export function CheckoutLedger({ cart, holding }: { cart: Cart; holding: boolean }) {
  const quantity = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  return <aside className="st-checkout-ledger" aria-label="Checkout summary">
    <div className="st-checkout-ledger-top">
      <span className="st-overline">YOUR ORDER / {String(cart.lines.length).padStart(2,'0')} LINES</span>
      <div className="st-ledger-ornament" aria-hidden="true"><span/><span/><span/><span/><span/></div>
      <h2>One last <em>look.</em></h2>
      <p>From the neighbourhood, to your doorstep.</p>
    </div>
    <div className="st-checkout-ledger-body">
      <div><span>Products</span><strong>{quantity} {quantity === 1 ? 'item' : 'items'}</strong></div>
      <div><span>Stock status</span><strong>{holding ? 'Checkout hold requested' : 'Checked at checkout'}</strong></div>
      <div><span>Fulfilment</span><strong>Single local branch</strong></div>
      <div className="st-ledger-total"><span>Order total</span><strong>{formatPaise(cart.totalPaise)}</strong></div>
    </div>
    <div className="st-checkout-ledger-bottom"><Icon name="lock" size={17}/>
      <p>Your reservation is confirmed only after the store accepts the hold. Stock and prices are revalidated.</p>
    </div>
    <Link href="/cart" className="st-ledger-back"><Icon name="arrow" size={14}/> Review bag</Link>
  </aside>;
}

export function ProfileBranch() {
  const { selectedStore } = useStore();
  return <div className="st-profile-location">
    <div className="st-profile-location-icon"><Icon name="pin" size={23}/></div>
    <div><span className="st-overline">YOUR SELECTED BRANCH</span>
      <strong>{selectedStore?.name ?? 'Explore nearby stores'}</strong>
      <p>{selectedStore?.city ?? 'Choose a store to see its catalogue'}</p>
    </div>
    <Link href="/stores" aria-label="Explore stores"><Icon name="upRight" size={18}/></Link>
  </div>;
}

export function PurchaseTrail({ current = 1 }: { current?: 1|2|3 }) {
  const steps = [
    { n: '01', title: 'Your bag', desc: 'Products selected' },
    { n: '02', title: 'CartLock', desc: '59-second checkout hold' },
    { n: '03', title: 'Confirmation', desc: 'After successful payment' },
  ];
  return <nav className="st-purchase-trail" aria-label="Purchase progress">
    {steps.map((step, i) => <div className="st-trail-step" data-current={i+1===current} data-complete={i+1<current} key={step.n}>
      <span>{step.n}</span><div><strong>{step.title}</strong><small>{step.desc}</small></div>
    </div>)}
  </nav>;
}
