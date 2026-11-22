import { AtelierHero } from '@/components/shop/atelier/atelier-hero';
import { ShopFlowArtwork } from '@/components/shop/atelier/retail-explainers';

export default function HomePage() {
  return <>
    <AtelierHero />
    <ul className="atelier-shop-principles" aria-label="How SmartTijori works">
      <li><strong>ShelfSync</strong><span>One stock view across the shop and counter</span></li>
      <li><strong>LastOne</strong><span>The last unit can only be allocated once</span></li>
      <li><strong>CartLock</strong><span>A timed hold at checkout</span></li>
      <li><strong>ZeroDeadEnd</strong><span>Find alternatives when an item sells out</span></li>
    </ul>
    <ShopFlowArtwork />
  </>;
}
