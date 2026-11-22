'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/atelier';
import { useStore } from '@/lib/session/store-context';
import { formatPaise } from '@/lib/utils/currency';
import { CartLockDial } from '../checkout/cartlock-dial';
import { CartLineItem } from './cart-line-item';

export function CartView() {
  const { cart, selectedStore, updateCartQuantity, removeFromCart, isLoading } = useStore();

  if (isLoading && !cart) {
    return <div className="st-journey st-journey-loading" role="status">
      <p className="st-kicker">PREPARING YOUR SELECTION</p>
      <div className="st-skeleton st-skeleton-heading" />
      <div className="st-skeleton st-skeleton-line" />
      <div className="st-skeleton st-skeleton-line" />
    </div>;
  }

  const hasItems = Boolean(cart?.lines.length);
  const totalItems = cart?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;

  return <div className="st-journey st-cart-page">
    <div className="st-breadcrumb"><Link href="/">THE NEIGHBOURHOOD</Link><span>/</span><span>YOUR BAG</span></div>

    <header className="st-page-intro">
      <div>
        <p className="st-kicker"><span className="st-live-dot" /> YOUR SELECTION, CLOSE TO HOME</p>
        <h1 className="st-display">Good things,<br/><em>almost yours.</em></h1>
        <p className="st-intro-copy">A little collection of everyday essentials, thoughtfully picked from the shelves around you.</p>
      </div>
      <Link className="st-text-link st-intro-link" href="/search">Keep exploring <Icon name="upRight" size={17}/></Link>
    </header>

    {hasItems && cart ? <div className="st-cart-layout">
      <div className="st-cart-left">
        <div className="st-section-heading">
          <div>
            <p className="st-kicker">01 / THE COLLECTION</p>
            <h2>In your bag <span className="st-count-bubble">{totalItems}</span></h2>
          </div>
          <span className="st-section-small">Picked from one local branch</span>
        </div>

        <div className="st-cart-items">
          {cart.lines.map((line, index) => <CartLineItem key={line.productId} line={line} index={index}
            onUpdateQuantity={qty => updateCartQuantity(line.productId, qty)}
            onRemove={() => removeFromCart(line.productId)} />)}
        </div>

        <div className="st-branch-note">
          <span className="st-branch-symbol"><Icon name="pin" size={19}/></span>
          <div><span className="st-kicker">YOUR FULFILMENT BRANCH</span>
            <strong>{selectedStore?.name ?? cart.storeId}</strong>
            <span>All items will be checked against this store’s stock at checkout.</span></div>
          <Link href="/stores" aria-label="Explore other stores"><Icon name="upRight" size={18}/></Link>
        </div>

        <div className="st-lock-feature">
          <div className="st-lock-feature-copy">
            <p className="st-kicker">02 / CARTLOCK</p>
            <h2>One little window.<br/><em>All yours to finish.</em></h2>
            <p>Your bag doesn’t reserve stock yet. When you begin checkout, SmartTijori attempts an exclusive 59-second hold for your items—subject to live availability.</p>
            <div className="st-lock-feature-foot"><span className="st-live-dot" /> THE CLOCK STARTS AT CHECKOUT, NOT HERE</div>
          </div>
          <div className="st-lock-feature-visual">
            <CartLockDial mode="preview" />
          </div>
        </div>
      </div>

      <aside className="st-cart-sidebar" aria-label="Order summary">
        <div className="st-order-summary">
          <div className="st-summary-top">
            <p className="st-kicker">03 / THE FINAL DETAILS</p>
            <h2>Order summary<span className="st-summary-spark" aria-hidden="true">✳</span></h2>
            <p>Your neighbourhood picks, all in one place.</p>
          </div>
          <div className="st-summary-rows">
            <div><span>Products</span><strong>{totalItems} {totalItems === 1 ? 'item' : 'items'}</strong></div>
            <div><span>Selected branch</span><strong>{selectedStore?.city ?? 'Your local store'}</strong></div>
            <div><span>Stock protection</span><strong>Starts at checkout</strong></div>
          </div>
          <div className="st-summary-total"><span>Total</span><strong>{formatPaise(cart.totalPaise)}</strong></div>
          <Link href="/checkout" className="st-primary-cta">Continue to checkout <Icon name="arrow" size={19}/></Link>
          <p className="st-summary-disclaimer"><Icon name="lock" size={14}/> Stock and payment are confirmed only during checkout.</p>
        </div>
        <div className="st-side-note">
          <span className="st-kicker">A BETTER WAY TO SHOP LOCALLY</span>
          <p>Real shelves. A fair window. <em>Fewer surprises.</em></p>
          <div className="st-side-note-art" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></div>
        </div>
      </aside>
    </div> : <section className="st-cart-empty">
      <div className="st-empty-art" aria-hidden="true"><span>✳</span><i/><i/></div>
      <div><p className="st-kicker">YOUR BAG IS READY TO BEGIN</p>
        <h2 className="st-display">Nothing in here.<br/><em>Yet.</em></h2>
        <p>There are good things waiting at {selectedStore?.name ?? 'your local branch'}. Find a favourite and give it a home.</p>
        <Link href="/search" className="st-primary-cta">Discover your next pick <Icon name="arrow" size={18}/></Link>
      </div>
    </section>}

    <div className="st-journey-footnote">
      <span>THE NEIGHBOURHOOD EDITION / YOUR BAG</span>
      <span>GOOD THINGS. CLOSER HOME.</span>
    </div>
  </div>;
}
