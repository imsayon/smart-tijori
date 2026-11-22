'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { ProductOffer } from '@/contracts';
import { api } from '@/lib/api-client';
import { useStore } from '@/lib/session/store-context';
import { Icon } from '@/components/ui/atelier';
import { ProductCard } from '@/components/shop/product/product-card';

const allocations = [
  {
    label: '01 · Available',
    stock: '01',
    title: 'One unit can be allocated.',
    online: 'Ready to request stock',
    counter: 'Ready for checkout',
    status: 'Available to promise',
  },
  {
    label: '02 · Online hold',
    stock: '00',
    title: 'Checkout reserves the final unit.',
    online: 'Allocated to the online hold',
    counter: 'No available units',
    status: 'Held at checkout',
  },
  {
    label: '03 · POS attempts',
    stock: '00',
    title: 'The counter cannot sell a held unit.',
    online: 'Hold remains valid until expiry',
    counter: 'Sale rejected: no free stock',
    status: 'Oversell prevented',
  },
] as const;

export function GreenAtelierLanding() {
  const { selectedStore, selectedStoreId, isLoading: storeLoading, openStoreModal } = useStore();
  const [offers, setOffers] = useState<ProductOffer[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedStoreId) {
      setOffers([]);
      return;
    }
    let mounted = true;
    setProductsLoading(true);
    setProductsError(false);
    void api.getProducts({ storeId: selectedStoreId, page: 1, includeUnavailable: false })
      .then(result => { if (mounted) setOffers(result.items.slice(0, 4)); })
      .catch(() => { if (mounted) { setProductsError(true); setOffers([]); } })
      .finally(() => { if (mounted) setProductsLoading(false); });
    return () => { mounted = false; };
  }, [selectedStoreId]);

  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;
    const elements = [...root.querySelectorAll<HTMLElement>('.ga-reveal')];
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.classList.add('ga-motion');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('ga-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.09, rootMargin: '0px 0px -18px 0px' });
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const phase = allocations[activeStep];

  return (
    <div className="ga-longscroll" id="top" ref={sectionRef}>
      <section className="ga-wrap ga-hero" aria-labelledby="ga-heading">
        <div className="ga-hero-copy ga-reveal">
          <p className="ga-kicker"><span className="ga-dot" /> THE NEIGHBOURHOOD EDITION <span className="ga-number">/ 001</span></p>
          <h1 id="ga-heading">Better things.<br /><em>Closer home.</em></h1>
          <p className="ga-hero-lead">Great finds from the stores around you. Discover what is available, reserve your pick at checkout, and never get stranded when something sells out.</p>
          <div className="ga-actions">
            <Link href="/search" className="ga-btn ga-btn-primary">Explore the collection <Icon name="upRight" size={16} /></Link>
            <button type="button" className="ga-btn ga-btn-outline" onClick={openStoreModal}>Find your store <Icon name="upRight" size={16} /></button>
          </div>
          <p className="ga-hero-index"><span>01—04</span><span>AN EASIER WAY TO SHOP NEARBY</span></p>
        </div>
        <div className="ga-hero-visual ga-reveal">
          <Image src="/atelier/neighbourhood-editorial.jpeg" fill priority sizes="(max-width: 850px) 100vw, 50vw"
            alt="Warmly lit everyday goods in a neighbourhood editorial display" />
          <div className="ga-corners" aria-hidden="true"><i/><i/><i/><i/></div>
          <span className="ga-vertical">CURATED FROM YOUR NEIGHBOURHOOD</span>
          <div className="ga-photo-note"><span className="ga-photo-led" /><span><b>STOCK CHECK</b><small>Confirmed again at checkout</small></span><Icon name="upRight" size={18} /></div>
        </div>
      </section>

      <section className="ga-wrap ga-principles" aria-label="Our four retail principles">
        {[
          ['01', 'ShelfSync', 'One stock view, every channel'],
          ['02', 'LastOne', 'The last unit, allocated once'],
          ['03', 'CartLock', '59 seconds to check out'],
          ['04', 'ZeroDeadEnd', 'Relevant alternatives, not dead ends'],
        ].map(([index, title, subtitle]) => (
          <div key={title}><span>{index}</span><strong>{title}</strong><small>{subtitle}</small></div>
        ))}
      </section>

      <section className="ga-wrap ga-collection ga-reveal" id="collection" aria-labelledby="ga-collection-heading">
        <div className="ga-section-head">
          <div>
            <p className="ga-kicker"><span className="ga-dot" /> SELECTED AT {selectedStore?.name?.toUpperCase() ?? 'YOUR LOCAL SHOP'} / {selectedStore?.city?.toUpperCase() ?? 'CHOOSE A BRANCH'}</p>
            <h2 id="ga-collection-heading">Good finds, <em>just around the corner.</em></h2>
          </div>
          <Link href="/search" className="ga-text-link">Browse all products <Icon name="upRight" size={15} /></Link>
        </div>
        {storeLoading || productsLoading ? <div className="ga-product-skeleton" role="status">Looking for products at your selected store…</div>
          : productsError ? <div className="ga-product-empty" role="alert">The branch catalogue is temporarily unavailable. <Link href="/search">Try the full shop</Link>.</div>
          : offers.length ? <div className="ga-product-rail">{offers.map(offer => <ProductCard key={offer.productId} offer={offer} />)}</div>
          : <div className="ga-product-empty">No available products at this store yet. <button type="button" className="ga-text-link" onClick={openStoreModal}>Choose a different store <Icon name="arrow" size={15} /></button></div>}
      </section>

      <section className="ga-wrap ga-intro ga-reveal" aria-labelledby="ga-intro-heading">
        <div className="ga-rule" />
        <div className="ga-intro-grid">
          <div><p className="ga-kicker"><span className="ga-dot" /> BEHIND THE COUNTER <span className="ga-number">/ 002</span></p>
            <h2 id="ga-intro-heading">Two places to shop.<br /><em>One version of the truth.</em></h2></div>
          <div className="ga-intro-copy">
            <p>A customer online. A cashier in-store. Only one unit left. SmartTijori coordinates allocation through one inventory authority, so a successful sale or hold is never just a hopeful guess.</p>
            <Link className="ga-text-link" href="/ops">Explore the retailer view <Icon name="upRight" size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="ga-system" id="stock" aria-labelledby="ga-lastone-heading">
        <div className="ga-wrap ga-system-grid">
          <div className="ga-reveal ga-system-copy">
            <p className="ga-kicker ga-kicker-light"><span className="ga-dot" /> THE LASTONE PROTOCOL <span className="ga-number">/ 003</span></p>
            <h2 id="ga-lastone-heading">One item.<br /><em>One allocation.</em></h2>
            <p>When two channels ask for the final unit, only one can allocate it. The other gets a clear result, without silently overselling stock.</p>
            <div className="ga-system-tabs" role="tablist" aria-label="LastOne allocation example">
              {allocations.map((step, i) => <button role="tab" aria-selected={activeStep === i}
                key={step.label} className={activeStep === i ? 'active' : ''}
                type="button" onClick={() => setActiveStep(i)}>{step.label}</button>)}
            </div>
            <div className="ga-system-fact" aria-live="polite">
              <div><span>AVAILABLE TO PROMISE</span><p>{phase.title}</p></div>
              <strong>{phase.stock}</strong>
            </div>
            <small className="ga-simulation-note">ILLUSTRATED RACE CONDITION · NOT A LIVE STOCK COUNTER</small>
          </div>
          <div className="ga-network ga-reveal">
            <div className="ga-network-dots" aria-hidden="true" />
            <svg viewBox="0 0 650 510" role="img" aria-label={'A web checkout and physical counter compete for the last unit; ' + phase.status}>
              <defs><linearGradient id="gaHubFill" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#315f44" /><stop offset="1" stopColor="#142b20" /></linearGradient></defs>
              <circle cx="337" cy="244" r="202" stroke="#496c4f" fill="none" opacity=".28"/>
              <circle cx="337" cy="244" r="154" stroke="#738f6d" fill="none" opacity=".32" strokeDasharray="3 10"/>
              <path d="M87 161 C178 161 208 229 256 229 M87 356 C178 356 211 266 256 266" stroke="#c0e292" strokeWidth="2.5" strokeDasharray="6 9" fill="none" className="ga-flow-line"/>
              <rect x="24" y="125" width="151" height="79" rx="4" fill="#234534" stroke="#729375"/>
              <rect x="24" y="323" width="151" height="79" rx="4" fill="#234534" stroke="#729375"/>
              <rect x="246" y="179" width="216" height="131" rx="5" fill="url(#gaHubFill)" stroke="#d0e68a" strokeWidth="2"/>
              <text x="99" y="154" textAnchor="middle" fill="#f4f6e9" fontSize="15">ONLINE SHOPPER</text>
              <text x="99" y="176" textAnchor="middle" fill="#b4c7b6" fontSize="11">CHECKOUT</text>
              <text x="99" y="353" textAnchor="middle" fill="#f4f6e9" fontSize="15">PHYSICAL POS</text>
              <text x="99" y="375" textAnchor="middle" fill="#b4c7b6" fontSize="11">STORE COUNTER</text>
              <text x="354" y="227" textAnchor="middle" fill="#d9e997" fontSize="20" fontFamily="Georgia,serif">SHARED STOCK</text>
              <text x="354" y="252" textAnchor="middle" fill="#c4d5c3" fontSize="12">POSTGRESQL</text>
              <text x="354" y="281" textAnchor="middle" fill="#c4d5c3" fontSize="11">One allocation authority</text>
              <circle cx="231" cy="220" r="6" fill="#d0e68a" className="ga-pulse"/>
              <circle cx="231" cy="281" r="6" fill="#d0e68a" className="ga-pulse"/>
              <text x="326" y="365" textAnchor="middle" fill="#a6c7a9" fontSize="12">{phase.status}</text>
              <text x="326" y="418" textAnchor="middle" fill="#729978" fontSize="10">ILLUSTRATIVE SYSTEM DIAGRAM</text>
            </svg>
            <div className="ga-network-status"><span>SHOPPER / {phase.online}</span><span>POS / {phase.counter}</span></div>
          </div>
        </div>
      </section>

      <section className="ga-wrap ga-editorial ga-reveal" aria-labelledby="ga-editorial-heading">
        <div className="ga-editorial-image">
          <Image src="/atelier/neighbourhood-editorial.jpeg" fill sizes="(max-width: 800px) 100vw, 47vw"
            alt="Products from an independent local shop arranged for an editorial photograph"/>
          <span>THE LOCAL EDIT / NO. 01</span>
        </div>
        <div className="ga-editorial-copy">
          <p className="ga-kicker"><span className="ga-dot" /> A BETTER KIND OF CONVENIENCE <span className="ga-number">/ 004</span></p>
          <h2 id="ga-editorial-heading">At your fingertips.<br /><em>From around the corner.</em></h2>
          <p>A store is more than an address. Choose a branch, explore its catalogue, and make considered purchases with availability checked at the counter and again at checkout.</p>
          <button className="ga-btn ga-btn-primary" type="button" onClick={openStoreModal}>Choose a branch <Icon name="upRight" size={15}/></button>
        </div>
      </section>

      <section className="ga-reservation" aria-labelledby="ga-reservation-heading">
        <div className="ga-wrap ga-reservation-grid">
          <div className="ga-reservation-copy ga-reveal">
            <p className="ga-kicker ga-kicker-light"><span className="ga-dot" /> CARTLOCK <span className="ga-number">/ 005</span></p>
            <h2 id="ga-reservation-heading">59 seconds.<br /><em>Only yours to check out.</em></h2>
            <p>Your cart alone holds nothing. When you explicitly begin checkout, an accepted reservation temporarily allocates the requested units. Retries do not extend its expiry.</p>
            <Link href="/cart" className="ga-btn ga-btn-lime">Explore the checkout flow <Icon name="upRight" size={16}/></Link>
            <p className="ga-reservation-note">LIVE HOLDS ARE VALIDATED BY POSTGRESQL · CART ≠ RESERVATION</p>
          </div>
          <div className="ga-clock ga-reveal" aria-label="An illustrative clock representing the 59-second checkout reservation">
            <span className="ga-clock-top">THE RESERVATION WINDOW</span>
            <div className="ga-clock-rings"><i/><i/><i/><div><strong>59</strong><span>SECONDS</span></div></div>
            <span className="ga-clock-caption">EXPLICIT HOLD · NEVER RENEWED BY RETRIES<br />ILLUSTRATIVE CLOCK · NOT A LIVE RESERVATION COUNTDOWN</span>
          </div>
        </div>
      </section>

      <section className="ga-wrap ga-recovery ga-reveal" aria-labelledby="ga-recovery-heading">
        <div>
          <p className="ga-kicker"><span className="ga-dot" /> ZERODEADEND <span className="ga-number">/ 006</span></p>
          <h2 id="ga-recovery-heading">Not in stock?<br /><em>Not the end of the story.</em></h2>
          <p>Better recommendations start by listening. Tell us what matters; explore compatible options; decide what to buy. Inventory is revalidated before checkout.</p>
          <Link className="ga-text-link" href="/search">Explore the alternative finder <Icon name="upRight" size={16}/></Link>
        </div>
        <div className="ga-recovery-card">
          <div className="ga-recovery-top"><span>ORIGINAL REQUEST</span><span>WHEN STOCK RUNS OUT</span></div>
          <span className="ga-mini-label">01 / YOUR CHOSEN PRODUCT</span>
          <h3>Your first choice.</h3>
          <p>Keep the intended category, price range and product preferences.</p>
          <div className="ga-recovery-divider"><span>RECONSIDERED, NOT AUTOMATICALLY REPLACED</span><Icon name="arrow" size={19}/></div>
          <div className="ga-match"><div className="ga-match-icon"><Icon name="check" size={28}/></div><div><span className="ga-mini-label">02 / COMPATIBLE ALTERNATIVES</span><h3>Your next good fit.</h3><p>Browse branch-specific candidates and select a replacement yourself.</p></div></div>
          <div className="ga-recovery-foot">STOCK CHECKED AGAIN AT CHECKOUT · NO UNAPPROVED SUBSTITUTIONS</div>
        </div>
      </section>

      <section className="ga-wrap ga-close ga-reveal" aria-labelledby="ga-close-heading">
        <div className="ga-rule"/>
        <p className="ga-kicker"><span className="ga-dot" /> THE CONNECTED STORE <span className="ga-number">/ 007</span></p>
        <h2 id="ga-close-heading">Your neighbourhood,<br /><em>in a better light.</em></h2>
        <div className="ga-close-bottom"><p>A thoughtful way to browse locally. A more dependable way to transact across channels.</p>
          <div className="ga-actions"><Link href="/search" className="ga-btn ga-btn-primary">Start exploring <Icon name="upRight" size={16}/></Link>
            <Link href="/ops" className="ga-btn ga-btn-outline">Retail workspace <Icon name="upRight" size={16}/></Link></div>
        </div>
      </section>
    </div>
  );
}
