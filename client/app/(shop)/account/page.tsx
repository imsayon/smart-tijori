import { cookies } from 'next/headers';
import Link from 'next/link';
import { AccessLayout } from '@/components/ops/layout/access-layout';
import { AccountAccess } from '@/components/account/account-access';
import { ProfileBranch } from '@/components/shop/atelier/purchase-details';
import { Icon } from '@/components/ui/atelier';
import { readAccount } from '@server/http/auth/email-session';

export default async function AccountPage({ searchParams }: PageProps<'/account'>) {
  const user = await readAccount((await cookies()).toString());
  const next = (await searchParams).next === 'checkout' ? '/checkout' : undefined;
  if (!user) return <AccessLayout next={next} />;

  const initial = (user.email.charAt(0) || 'S').toUpperCase();

  return <section className="st-purchase-page st-profile-page">
    <div className="st-profile-hero">
      <div className="st-profile-hero-copy">
        <p className="st-overline"><span className="st-mini-dot"/> YOUR SPACE / THE NEIGHBOURHOOD EDITION</p>
        <h1 className="atelier-heading">A place for <em>your favourites.</em></h1>
        <p>Your finds, your store, and your orders — kept in one thoughtful corner.</p>
        <div className="st-profile-member">
          <span className="st-profile-avatar" aria-hidden="true">{initial}</span>
          <span><small>YOUR ACCOUNT</small><strong>{user.email}</strong></span>
          <span className="st-profile-verified"><Icon name="check" size={14}/> Signed in</span>
        </div>
      </div>
      <div className="st-profile-art" aria-hidden="true">
        <div className="st-profile-art-disc st-profile-art-disc-one"/>
        <div className="st-profile-art-disc st-profile-art-disc-two"/>
        <div className="st-profile-art-disc st-profile-art-disc-three"/>
        <div className="st-profile-art-seal"><span>✳</span><small>BETTER THINGS<br/>CLOSER HOME</small></div>
        <span className="st-profile-art-corner">S/T — 2026</span>
      </div>
    </div>

    <div className="st-profile-section-heading">
      <p className="st-overline">01 / YOUR CORNER</p>
      <h2>Everything in <em>its place.</em></h2>
      <p>Find your orders and pick up where you left off.</p>
    </div>

    <div className="st-profile-grid">
      <Link className="st-profile-navigation-card" href="/orders">
        <span className="st-profile-nav-index">01 / YOUR JOURNEY</span>
        <span className="st-profile-nav-icon"><Icon name="receipt" size={24}/></span>
        <strong>Order history</strong>
        <p>Follow your purchases and check their status.</p>
        <span className="st-profile-nav-arrow"><Icon name="upRight" size={19}/></span>
      </Link>
      <Link className="st-profile-navigation-card" href="/cart">
        <span className="st-profile-nav-index">02 / YOUR SELECTION</span>
        <span className="st-profile-nav-icon"><Icon name="shop" size={24}/></span>
        <strong>Saved bag</strong>
        <p>Return to your products before checkout.</p>
        <span className="st-profile-nav-arrow"><Icon name="upRight" size={19}/></span>
      </Link>
      <Link className="st-profile-navigation-card" href="/search">
        <span className="st-profile-nav-index">03 / LOCAL FINDS</span>
        <span className="st-profile-nav-icon"><Icon name="search" size={24}/></span>
        <strong>Explore the shelves</strong>
        <p>Discover more from your selected store.</p>
        <span className="st-profile-nav-arrow"><Icon name="upRight" size={19}/></span>
      </Link>
    </div>

    <div className="st-profile-bottom">
      <ProfileBranch/>
      <div className="st-profile-session">
        <div>
          <span className="st-overline">02 / ACCOUNT ACCESS</span>
          <h3>Your space, <em>your way.</em></h3>
          <p>Finish your visit whenever you like.</p>
        </div>
        <AccountAccess signedIn/>
      </div>
    </div>
  </section>;
}
