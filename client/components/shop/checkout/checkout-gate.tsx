import Link from 'next/link';
import { CheckoutDialPreview } from './checkout-dial-preview';
import { Icon } from '@/components/ui/atelier';

/** Deliberately non-transactional until the actual checkout flow is ready. */
export function CheckoutGate() {
  return <main className="st-journey st-checkout-page">
    <div className="st-breadcrumb"><Link href="/cart">YOUR BAG</Link><span>/</span><span>CHECKOUT</span></div>
    <header className="st-page-intro">
      <div>
        <p className="st-kicker">YOUR BAG / CARTLOCK PREVIEW</p>
        <h1 className="st-display">59 seconds.<br/><em>One clean reveal.</em></h1>
        <p className="st-intro-copy">Watch the dial count down from 59 to zero. When it reaches 00:00, a scannable partner QR appears in its place.</p>
      </div>
    </header>
    <section className="st-checkout-ready" aria-label="CartLock countdown and QR preview">
      <div className="st-checkout-ready-copy">
        <p className="st-kicker">CARTLOCK / INTERACTIVE PREVIEW</p>
        <h2>Watch it count.<br/><em>Then scan.</em></h2>
        <p>The code opens the merchant workspace. This is a demonstration only: your bag stays unchanged and no goods are reserved or handed over.</p>
        <Link className="st-primary-cta" href="/cart">Return to your bag <Icon name="arrow" size={17}/></Link>
        <Link href="/search" className="st-text-link">Explore the collection <Icon name="upRight" size={16}/></Link>
      </div>
      <CheckoutDialPreview />
    </section>
  </main>;
}
