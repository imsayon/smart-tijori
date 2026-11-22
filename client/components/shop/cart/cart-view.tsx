'use client';

import Link from 'next/link';
import { useStore } from '@/lib/session/store-context';
import { formatPaise } from '@/lib/utils/currency';
import { Icon } from '@/components/ui/atelier';
import { CartLineItem } from './cart-line-item';
import { CartLockPreview, PurchaseTrail } from '../atelier/purchase-details';

export function CartView() {
  const { cart, selectedStore, updateCartQuantity, removeFromCart, isLoading } = useStore();

  if (isLoading && !cart) {
    return <section className="st-purchase-page st-purchase-loading" role="status" aria-live="polite">
      <div className="st-purchase-loading-line"/>
      <h2 className="atelier-heading">Gathering your finds.</h2>
      <p>Loading cart details…</p>
    </section>;
  }

  if (!cart || cart.lines.length === 0) {
    return <section className="st-purchase-page st-empty-bag">
      <span className="st-overline">YOUR BAG / 00</span>
      <div className="st-empty-bag-art" aria-hidden="true"><Icon name="shop" size={65}/></div>
      <h1 className="atelier-heading">Good things <em>start here.</em></h1>
      <p>Your bag is empty. Explore what’s on the shelves at {selectedStore?.name ?? 'your local branch'}.</p>
      <Link className="st-button-primary" href="/search">Explore the collection <Icon name="upRight" size={17}/></Link>
      <CartLockPreview compact/>
    </section>;
  }

  const units = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  return <section className="st-purchase-page st-cart-page">
    <div className="st-purchase-heading">
      <div className="st-purchase-heading-copy">
        <p className="st-overline"><span className="st-mini-dot"/> THE NEIGHBOURHOOD EDITION / YOUR BAG</p>
        <h1 className="atelier-heading">A little closer <em>to yours.</em></h1>
        <p>Thoughtful finds from <strong>{selectedStore?.name ?? cart.storeId}</strong>. All in one place, ready when you are.</p>
      </div>
      <div className="st-bag-count" aria-label={`${units} units in your bag`}>
        <span>IN YOUR BAG</span><strong>{String(units).padStart(2,'0')}</strong><small>{units === 1 ? 'ITEM' : 'ITEMS'}</small>
      </div>
    </div>

    <PurchaseTrail current={1}/>
    <div className="st-cart-layout">
      <div className="st-cart-main">
        <div className="st-cart-section-head">
          <div><span className="st-overline">01 / YOUR SELECTION</span>
            <h2>Good things, <em>gathered.</em></h2></div>
          <Link href="/search" className="st-quiet-link">Continue shopping <Icon name="upRight" size={15}/></Link>
        </div>

        <div className="st-cart-lines">
          {cart.lines.map((line, index) =>
            <CartLineItem key={line.productId} line={line} index={index + 1}
              onUpdateQuantity={qty => updateCartQuantity(line.productId, qty)}
              onRemove={() => removeFromCart(line.productId)}/>)}
        </div>

        <div className="st-cart-information">
          <Icon name="pulse" size={18}/>
          <p><strong>Real shelves. Real choices.</strong> Your bag remembers your picks, but does not reserve stock. Availability is checked again when checkout begins.</p>
        </div>
        <CartLockPreview/>
      </div>

      <aside className="st-cart-summary" aria-label="Bag summary">
        <div className="st-cart-summary-top">
          <p className="st-overline">YOUR ORDER / AT A GLANCE</p>
          <h2>Almost <em>there.</em></h2>
          <p>One store. One bag. No surprises about when your stock is held.</p>
        </div>
        <div className="st-cart-summary-grid">
          <div><span>Selected products</span><strong>{cart.lines.length} {cart.lines.length === 1 ? 'line' : 'lines'}</strong></div>
          <div><span>Total quantity</span><strong>{units} {units === 1 ? 'unit' : 'units'}</strong></div>
          <div><span>Your store</span><strong>{selectedStore?.city ?? 'Local branch'}</strong></div>
        </div>
        <div className="st-cart-total"><span>Total today</span><strong>{formatPaise(cart.totalPaise)}</strong>
          <small>Final stock confirmed at checkout</small></div>
        <Link href="/checkout" className="st-button-primary st-cart-checkout">
          Proceed to checkout <Icon name="arrow" size={19}/>
        </Link>
        <div className="st-cart-summary-promise"><Icon name="lock" size={17}/><p>CartLock starts only once your checkout reservation is accepted.</p></div>
        <div className="st-cart-summary-seal" aria-hidden="true">S · T <span>LOCAL FIRST / ALWAYS</span></div>
      </aside>
    </div>
  </section>;
}
