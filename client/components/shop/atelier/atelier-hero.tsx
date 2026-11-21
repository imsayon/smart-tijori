'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/ui/atelier';
import dynamic from 'next/dynamic';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';

const SpatialScene = dynamic(() => import('./spatial-scene'), { ssr: false });

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function MechanismPoster() {
  return (
    <svg className="atelier-mechanism" viewBox="0 0 560 410" fill="none" aria-hidden="true">
      <ellipse cx="280" cy="238" rx="233" ry="111" transform="rotate(-12 280 238)" stroke="#93a985" opacity=".4" />
      <ellipse cx="280" cy="238" rx="216" ry="100" transform="rotate(-12 280 238)" stroke="#93a985" opacity=".45" />
      {Array.from({ length: 52 }, (_, index) => {
        const theta = (index / 52) * 2 * Math.PI;
        const x = Math.cos(theta);
        const y = Math.sin(theta);
        const px = (value: number) => value.toFixed(2);
        return <path key={index} d={`M ${px(280 + x * 179)} ${px(238 + y * 79)} L ${px(280 + x * 216)} ${px(238 + y * 100)}`}
          transform="rotate(-12 280 238)" stroke={index % 3 === 0 ? '#daec9e' : '#8da780'} strokeWidth="6" opacity={y > 0 ? '.95' : '.5'} />;
      })}
      <path d="M 192 161 L 294 128 L 371 161 L 272 195 Z" fill="#8da780" stroke="#b9cf9b" />
      <path d="M 192 161 L 272 195 L 272 292 L 192 258 Z" fill="#65886e" stroke="#9db88d" />
      <path d="M 272 195 L 371 161 L 371 258 L 272 292 Z" fill="#3f6651" stroke="#93ad84" />
    </svg>
  );
}

export function RetailPulse({ shopper = false }: { shopper?: boolean }) {
  const root = useRef<HTMLElement>(null);
  const [scene, setScene] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | 'editorial'>(shopper ? 'editorial' : '3d');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = root.current;
    if (!section) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const wide = window.matchMedia('(min-width: 750px)');
    let visible = false;
    let contextLost = false;
    let scope: { revert(): void } | undefined;
    let stopped = false;

    const sync = () => setScene(visible && !contextLost && !motion.matches && wide.matches && !document.hidden && (!shopper || viewMode === '3d'));
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
    observer.observe(section);

    function onScroll() {
      if (!visible || motion.matches) return;
      setProgress(Math.min(1, Math.max(0, -section!.getBoundingClientRect().top / (section!.offsetHeight * 0.65))));
    }

    if (!motion.matches) {
      void import('animejs').then(({ animate }) => {
        if (stopped || motion.matches) return;
        animate('.atelier-hero-display', { opacity: [0.75, 1], translateY: [14, 0], duration: 650, ease: 'outQuad' });
      }).catch(() => {});
    }

    const onMotionChange = () => { scope?.revert(); sync(); };
    const onContextLost = () => { contextLost = true; sync(); };
    section.addEventListener('webglcontextlost', onContextLost, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    motion.addEventListener('change', onMotionChange);
    wide.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      stopped = true;
      scope?.revert();
      observer.disconnect();
      section.removeEventListener('webglcontextlost', onContextLost, true);
      window.removeEventListener('scroll', onScroll);
      motion.removeEventListener('change', onMotionChange);
      wide.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [shopper, viewMode]);

  return (
    <section className={`atelier-hero ${shopper ? 'atelier-hero-shop' : 'atelier-hero-ops'}`} ref={root}>
      <div className="atelier-hero-display">
        <p className="atelier-label">{shopper ? 'The neighbourhood edition / 001' : 'One stock ledger'}</p>
        <h2 className="atelier-heading">{shopper ? <>Better things.<br /><em>Closer home.</em></> : <>Every counter.<br /><em>In sync.</em></>}</h2>
        <p>{shopper
          ? 'Great finds from the stores around you. Discover what is available, reserve your pick at checkout, and see alternatives when something sells out.'
          : 'Online reservations and counter sales draw from the same branch inventory.'}</p>
        <div className="atelier-hero-actions">
          <Link href={shopper ? '/#market' : '/ops/inventory'} className="atelier-action">
            {shopper ? 'Explore the collection' : 'Explore inventory'} <Icon name="arrow" size={16} />
          </Link>
          {shopper && <Link href="/stores" className="atelier-secondary">Find your store <Icon name="arrow" size={15} /></Link>}
        </div>
        {shopper && <p className="atelier-hero-index"><span>01—04</span><span>AN EASIER WAY TO SHOP NEARBY</span></p>}
      </div>
      <div className="atelier-hero-art">
        {shopper && (
          <button
            type="button"
            className="atelier-hero-3d-toggle"
            onClick={() => setViewMode(prev => prev === '3d' ? 'editorial' : '3d')}
            aria-label={`Switch to ${viewMode === '3d' ? 'Editorial View' : '3D Spatial Lock View'}`}
          >
            <span className="pulse" aria-hidden="true" />
            <span>{viewMode === '3d' ? 'Show photograph' : 'Explore in 3D'}</span>
          </button>
        )}

        {shopper && viewMode === 'editorial' ? (
          <>
            <Image
              className="atelier-hero-photo"
              src="/atelier/neighbourhood-editorial.jpeg"
              alt="Warmly lit travel essentials arranged by a window"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 55vw"
            />
            <span className="atelier-photo-frame" />
            <div className="atelier-photo-caption">
              <span className="atelier-photo-dot" aria-hidden="true" />
              <div><b>STOCK CHECK</b><span>Revalidated at checkout</span></div>
              <Icon name="upRight" size={16} />
            </div>
          </>
        ) : (
          <>
            <MechanismPoster />
            <span className="atelier-hero-notes atelier-label">CartLock / one allocation</span>
            {scene && (
              <div className="atelier-canvas">
                <SceneBoundary>
                  <SpatialScene mode={shopper ? 'hero' : 'telemetry'} progress={progress} interactive />
                </SceneBoundary>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export function AtelierHero() {
  return <RetailPulse shopper />;
}

