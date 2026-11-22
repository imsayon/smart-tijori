import Link from 'next/link';
import { CheckoutDialPreview } from './checkout-dial-preview';
import { Icon } from '@/components/ui/atelier';

export function CheckoutGate({ reason }: { reason: 'signin' | 'payment' }) {
  const requiresAccount = reason === 'signin';
  return <main className="st-journey st-checkout-page">
    <div className="st-breadcrumb"><Link href="/cart">YOUR BAG</Link><span>/</span><span>CHECKOUT</span></div>
    <div className="st-page-intro">
      <div><p className="st-kicker">YOUR BAG / ONE LAST DETAIL</p>
        <h1 className="st-display">{requiresAccount ? <>One more step,<br/><em>then you’re set.</em></> : <>59 seconds.<br/><em>One clean reveal.</em></>}</h1>
        <p className="st-intro-copy">{requiresAccount
          ? 'Sign in to keep your order history together and complete checkout.'
          : 'Your picks are still in your bag. Explore the 59-second CartLock experience and see the QR appear when the dial reaches zero.'}</p>
      </div>
    </div>
    <div className="st-checkout-ready">
      <div className="st-checkout-ready-copy">
        <p className="st-kicker">CARTLOCK / STOCK PROTECTION</p>
        <h2>{requiresAccount ? <>Your local picks,<br/><em>all together.</em></> : <>Watch it count.<br/><em>Then scan.</em></>}</h2>
        <p>{requiresAccount
          ? 'Your bag isn’t held yet. Sign in first, then start a 59-second reservation at checkout.'
          : 'This is a visual preview. The QR opens the merchant workspace; it does not reserve stock or confirm an order.'}</p>
        <Link className="st-primary-cta" href={requiresAccount ? '/account?next=checkout' : '/cart'}>
          {requiresAccount ? 'Sign in to continue' : 'Return to your bag'} <Icon name="arrow" size={17}/>
        </Link>
        <Link href="/search" className="st-text-link">Explore the collection <Icon name="upRight" size={16}/></Link>
      </div>
      <CheckoutDialPreview />
    </div>
  </main>;
}
