import { AtelierHero } from '@/components/shop/atelier/atelier-hero';
import { CartLockStory } from '@/components/shop/atelier/cartlock-story';
import { BranchBanner } from '@/components/shop/navigation/branch-banner';
import { Catalog } from '@/components/shop/catalog/catalog';
import { AtelierTitle } from '@/components/ui/atelier';

export default function HomePage() {
  return <>
    <AtelierHero />
    <section id="branch" className="atelier-home-section">
      <AtelierTitle context="01 / Your neighbourhood" lead="Start with the" accent="right shop."
        description="Choose a branch to see the products and availability on its own shelves." />
      <BranchBanner />
    </section>
    <section id="market" className="atelier-home-section atelier-market-section">
      <AtelierTitle context="02 / At this branch" lead="Good things," accent="gathered."
        description="Every product and availability state below comes from the branch you selected." />
      <Catalog />
    </section>
    <CartLockStory />
  </>;
}
