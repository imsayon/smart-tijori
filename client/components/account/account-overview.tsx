'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/atelier';
import { useStore } from '@/lib/session/store-context';
import { AccountAccess } from './account-access';

function initials(email: string) {
  const name = email.split('@')[0]?.replace(/[^a-zA-Z0-9]/g, '') ?? '';
  return name.slice(0, 2).toUpperCase() || 'ST';
}

export function AccountOverview({ email }: { email: string }) {
  const { selectedStore, cart, isLoading } = useStore();
  const itemCount = cart?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0;
  return <div className="st-journey st-account-page">
    <div className="st-breadcrumb"><Link href="/">THE NEIGHBOURHOOD</Link><span>/</span><span>YOUR ACCOUNT</span></div>
    <header className="st-page-intro">
      <div><p className="st-kicker"><span className="st-live-dot"/> A LITTLE SPACE TO CALL YOUR OWN</p>
        <h1 className="st-display">Everything local.<br/><em>All yours.</em></h1>
        <p className="st-intro-copy">Your favourite stores, your next find, and every purchase—thoughtfully kept together.</p>
      </div>
      <Link href="/search" className="st-text-link st-intro-link">Back to the shelves <Icon name="upRight" size={17}/></Link>
    </header>

    <section className="st-account-hero" aria-labelledby="account-identity">
      <div className="st-account-hero-copy">
        <p className="st-kicker">SMARTTIJORI / YOUR CORNER</p>
        <div className="st-account-avatar" aria-hidden="true">{initials(email)}<span>✳</span></div>
        <span className="st-account-welcome">Welcome back.</span>
        <h2 id="account-identity">{email}</h2>
        <p>Your account is ready. Continue where you left off, or discover something new close to home.</p>
        <div className="st-account-hero-actions">
          <Link href="/orders" className="st-primary-cta st-primary-cta-light">Your orders <Icon name="arrow" size={17}/></Link>
          <Link href="/cart" className="st-outline-cta">View your bag <Icon name="upRight" size={16}/></Link>
        </div>
      </div>
      <div className="st-account-hero-art" aria-hidden="true">
        <div className="st-account-halo st-account-halo-one"/>
        <div className="st-account-halo st-account-halo-two"/>
        <div className="st-account-halo st-account-halo-three"/>
        <span className="st-account-hero-mark">✳</span>
        <span className="st-account-art-caption">YOUR NEIGHBOURHOOD / CONNECTED</span>
      </div>
    </section>

    <div className="st-account-grid">
      <section className="st-account-card st-account-branch">
        <div className="st-account-card-icon"><Icon name="pin" size={20}/></div>
        <p className="st-kicker">01 / YOUR LOCAL SPOT</p>
        <h3>Shopping close<br/><em>to home.</em></h3>
        <p>Currently browsing</p>
        <strong>{isLoading ? 'Finding your branch…' : selectedStore?.name ?? 'Select a local store'}</strong>
        <Link href="/stores" className="st-text-link">Explore stores <Icon name="upRight" size={16}/></Link>
      </section>

      <section className="st-account-card st-account-bag">
        <div className="st-account-card-icon"><Icon name="shop" size={20}/></div>
        <p className="st-kicker">02 / SAVED FOR LATER</p>
        <h3>Your little<br/><em>collection.</em></h3>
        <div className="st-account-number">{isLoading ? '—' : itemCount.toString().padStart(2, '0')}<span> {itemCount === 1 ? 'ITEM' : 'ITEMS'} IN BAG</span></div>
        <Link href="/cart" className="st-text-link">Continue shopping <Icon name="upRight" size={16}/></Link>
      </section>

      <section className="st-account-card st-account-orders">
        <div className="st-account-card-icon"><Icon name="receipt" size={20}/></div>
        <p className="st-kicker">03 / YOUR PURCHASES</p>
        <h3>Every find,<br/><em>remembered.</em></h3>
        <p>Check your past purchases and order status in one place.</p>
        <Link href="/orders" className="st-text-link">View order history <Icon name="upRight" size={16}/></Link>
      </section>
    </div>

    <section className="st-account-settings">
      <div><p className="st-kicker">ACCOUNT & PRIVACY</p><h2>Your space. Your choice.</h2>
        <p>Signed in as <strong>{email}</strong></p></div>
      <AccountAccess signedIn />
    </section>
    <div className="st-journey-footnote"><span>THE NEIGHBOURHOOD EDITION / YOUR ACCOUNT</span><span>BETTER THINGS. CLOSER HOME.</span></div>
  </div>;
}
