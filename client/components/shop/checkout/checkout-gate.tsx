import Link from 'next/link';
import { CartLockDial } from './cartlock-dial';
import { Icon } from '@/components/ui/atelier';

export function CheckoutGate({ reason }: { reason: 'signin' | 'payment' }) {
  const requiresAccount = reason === 'signin';
  return <main className="st-journey st-checkout-page">
    <div className="st-breadcrumb"><Link href="/cart">YOUR BAG</Link><span>/</span><span>CHECKOUT</span></div>
    <div className="st-page-intro">
      <div><p className="st-kicker">YOUR BAG / ONE LAST DETAIL</p>
        <h1 className="st-display">{requiresAccount ? <>One more step,<br/><em>then you’re set.</em></> : <>A small pause.<br/><em>Your bag stays.</em></>}</h1>
        <p className="st-intro-copy">{requiresAccount
          ? 'Sign in to keep your order history together and complete checkout.'
          : 'Online checkout is not accepting payments right now. Your picks are still in your bag—nothing has been charged.'}</p>
      </div>
    </div>
    <div className="st-checkout-ready">
      <div className="st-checkout-ready-copy">
        <p className="st-kicker">CARTLOCK / STOCK PROTECTION</p>
        <h2>{requiresAccount ? <>Your local picks,<br/><em>all together.</em></> : <>We’ll be here<br/><em>when you return.</em></>}</h2>
        <p>{requiresAccount
          ? 'Your bag isn’t held yet. Sign in first, then start a 59-second reservation at checkout.'
          : 'No stock has been reserved. You can continue browsing or review your selected products.'}</p>
        <Link className="st-primary-cta" href={requiresAccount ? '/account?next=checkout' : '/cart'}>
          {requiresAccount ? 'Sign in to continue' : 'Return to your bag'} <Icon name="arrow" size={17}/>
        </Link>
        <Link href="/search" className="st-text-link">Explore the collection <Icon name="upRight" size={16}/></Link>
      </div>
      <CartLockDial mode="preview"/>
    </div>
  </main>;
}
