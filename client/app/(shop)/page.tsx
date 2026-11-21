import { AtelierHero } from '@/components/shop/atelier/atelier-hero';
import { CartLockStory } from '@/components/shop/atelier/cartlock-story';
import { CartLockEdition, ShopFlowArtwork } from '@/components/shop/atelier/retail-explainers';
import { BranchBanner } from '@/components/shop/navigation/branch-banner';
import { Catalog } from '@/components/shop/catalog/catalog';
import { AtelierTitle, Icon } from '@/components/ui/atelier';
import { Interactive3DCard } from '@/components/shop/atelier/interactive-3d-card';

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
    <CartLockEdition />
    <CartLockStory />
    <ShopFlowArtwork />
    <section id="guarantee" className="atelier-home-section">
      <AtelierTitle context="04 / The Tijori Protocol" lead="Commerce built on" accent="certainty."
        description="From store shelf to checkout, each unit is tracked in one authoritative ledger." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Interactive3DCard>
          <div className="p-6 bg-[#faf7f0] border border-[#dcd6c9] rounded-md h-full flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-full bg-[#142a20] text-[#d4e992] flex items-center justify-center mb-4">
                <Icon name="lock" size={18} />
              </div>
              <h3 className="font-serif text-2xl text-[#16261f] mb-2">CartLock Authority</h3>
              <p className="text-sm text-[#53645b] leading-relaxed">
                When you initiate checkout, stock is locked directly in the transactional database. No overselling, no ghost reservations.
              </p>
            </div>
            <p className="mt-6 text-xs font-mono uppercase tracking-wider text-[#6e4731]">01 / Precision Hold</p>
          </div>
        </Interactive3DCard>

        <Interactive3DCard>
          <div className="p-6 bg-[#faf7f0] border border-[#dcd6c9] rounded-md h-full flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-full bg-[#6e4731] text-[#faf7f2] flex items-center justify-center mb-4">
                <Icon name="refresh" size={18} />
              </div>
              <h3 className="font-serif text-2xl text-[#16261f] mb-2">Zero Dead Ends</h3>
              <p className="text-sm text-[#53645b] leading-relaxed">
                If the last item sells out at your counter while you browse, SmartTijori instantly surfaces available nearby branches and identical alternatives.
              </p>
            </div>
            <p className="mt-6 text-xs font-mono uppercase tracking-wider text-[#6e4731]">02 / Intelligent Recovery</p>
          </div>
        </Interactive3DCard>

        <Interactive3DCard>
          <div className="p-6 bg-[#faf7f0] border border-[#dcd6c9] rounded-md h-full flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-full bg-[#142a20] text-[#c9a247] flex items-center justify-center mb-4">
                <Icon name="pulse" size={18} />
              </div>
              <h3 className="font-serif text-2xl text-[#16261f] mb-2">One Shared Inventory</h3>
              <p className="text-sm text-[#53645b] leading-relaxed">
                In-store and online sales use one stock allocation process, with updates carried through the system.
              </p>
            </div>
            <p className="mt-6 text-xs font-mono uppercase tracking-wider text-[#6e4731]">03 / Shared Availability</p>
          </div>
        </Interactive3DCard>
      </div>
    </section>
  </>;
}
