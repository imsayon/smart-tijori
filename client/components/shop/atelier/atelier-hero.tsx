import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/ui/atelier';

export function AtelierHero() {
  return <section className="atelier-hero atelier-hero-shop" aria-labelledby="shop-intro">
    <div className="atelier-hero-display">
      <p className="atelier-label">The neighbourhood edition</p>
      <h1 className="atelier-heading" id="shop-intro">Better things.<br /><em>Closer home.</em></h1>
      <p>Browse your local store, reserve items at checkout, and find alternatives when something sells out.</p>
      <div className="atelier-hero-actions">
        <Link href="/search" className="atelier-action">Explore the collection <Icon name="upRight" size={16} /></Link>
        <Link href="/stores" className="atelier-secondary">Find your store <Icon name="upRight" size={15} /></Link>
      </div>
    </div>
    <div className="atelier-hero-art">
      <Image className="atelier-hero-photo" src="/atelier/neighbourhood-editorial.jpeg"
        alt="Warmly lit travel essentials arranged by a window" fill preload sizes="(max-width: 760px) 100vw, 55vw" />
      <span className="atelier-photo-frame" aria-hidden="true" />
      <div className="atelier-photo-caption">
        <span className="atelier-photo-dot" aria-hidden="true" />
        <div><b>STOCK CHECK</b><span>Confirmed again at checkout</span></div>
      </div>
    </div>
  </section>;
}
