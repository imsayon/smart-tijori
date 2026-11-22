import Link from 'next/link';
import { Wordmark } from '@/components/ui/atelier';

export function Footer() {
  return (
    <footer className="ga-site-footer" id="site-footer">
      <div className="ga-wrap">
        <div className="ga-footer-top">
          <div className="ga-footer-brand"><Wordmark href="/" /><p>Better things. Closer home.<br />Thoughtful retail, built around your neighbourhood.</p></div>
          <div className="ga-footer-links">
            <div><span>EXPLORE</span><Link href="/search">Shop all</Link><Link href="/stores">Our stores</Link><Link href="/#stock">How it works</Link></div>
            <div><span>PLATFORM</span><Link href="/ops">Retail workspace</Link><Link href="/account">Account</Link><Link href="/orders">Orders</Link></div>
          </div>
        </div>
        <div className="ga-footer-bottom"><span>SMARTTIJORI / PING FLOYD</span><span>INVENTORY IS BRANCH-SPECIFIC · CHECKED AGAIN AT CHECKOUT</span><a href="#top">BACK TO TOP ↑</a></div>
      </div>
    </footer>
  );
}
