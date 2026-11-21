'use client';

import dynamic from 'next/dynamic';
import { AccountAccess } from '@/components/account/account-access';
import { AtelierTitle } from '@/components/ui/atelier';

const SpatialScene = dynamic(() => import('@/components/shop/atelier/spatial-scene'), { ssr: false });

export function AccessLayout({ merchant = false, next }: { merchant?: boolean; next?: '/checkout' }) {
  return <div className="atelier-access-page">
    {merchant && <AtelierTitle lead="Merchant" accent="access." description="Sign in with the account assigned to your branch." />}
    <section className="atelier-access">
      <div className="atelier-access-art">
        <p className="atelier-label">SmartTijori / {merchant ? 'Merchant workspace' : 'Neighbourhood shop'}</p>
        <h2 className="atelier-heading">{merchant ? 'Behind every great store,' : 'Your shop,'}
          {' '}<em>{merchant ? 'a clear picture.' : 'close to home.'}</em></h2>
        <p>{merchant ? 'Manage stock, reservations and counter sales for your branch.' : 'Keep your bag and track orders in one place.'}</p>
        <div className="w-full h-44 relative my-2 hidden sm:block">
          <SpatialScene mode="vault" progress={0.5} interactive />
        </div>
        <svg aria-hidden="true" className="atelier-access-wave" viewBox="0 0 640 190" fill="none" preserveAspectRatio="none">
          {Array.from({ length: 34 }, (_, index) => {
            const offset = index * 3;
            return <path key={index} d={`M-10 ${56 + offset} C 160 ${176 - offset}, 320 ${-20 + offset * 1.6}, 650 ${72 + offset * .7}`}
              stroke="#c9a247" strokeWidth=".6" opacity=".35" />;
          })}
        </svg>
      </div>
      <AccountAccess merchant={merchant} next={next} />
    </section>
  </div>;
}
