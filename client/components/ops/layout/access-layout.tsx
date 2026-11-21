import { AccountAccess } from '@/components/account/account-access';
import { AtelierTitle } from '@/components/ui/atelier';

export function AccessLayout({ merchant = false, next }: { merchant?: boolean; next?: '/checkout' }) {
  return <div className="atelier-access-page">
    {merchant && <AtelierTitle lead="Merchant" accent="access." description="Sign in with the account assigned to your branch." />}
    <section className="atelier-access">
      <div className="atelier-access-art">
        <p className="atelier-label">SmartTijori / {merchant ? 'Merchant workspace' : 'Neighbourhood shop'}</p>
        <h2 className="atelier-heading">{merchant ? 'Behind every great store,' : 'Your shop,'}
          {' '}<em>{merchant ? 'a clear picture.' : 'close to home.'}</em></h2>
        <p>{merchant ? 'Manage stock, reservations and counter sales for your branch.' : 'Keep your bag and track orders in one place.'}</p>
        <svg aria-hidden="true" className="atelier-access-wave" viewBox="0 0 640 190" fill="none" preserveAspectRatio="none">
          {Array.from({ length: 34 }, (_, index) => {
            const offset = index * 3;
            return <path key={index} d={`M-10 ${56 + offset} C 160 ${176 - offset}, 320 ${-20 + offset * 1.6}, 650 ${72 + offset * .7}`}
              stroke="#9bb27c" strokeWidth=".6" opacity=".32" />;
          })}
        </svg>
      </div>
      <AccountAccess merchant={merchant} next={next} />
    </section>
  </div>;
}
