'use client';

import Link from 'next/link';
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
    const sync = () => setScene(visible && !contextLost && !motion.matches && wide.matches && !document.hidden);
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
    observer.observe(section);
    function onScroll() {
      if (!visible || motion.matches) return;
      setProgress(Math.min(1, Math.max(0, -section!.getBoundingClientRect().top / (section!.offsetHeight * 0.65))));
    }
    if (!motion.matches) {
      void import('animejs').then(({ createScope, animate }) => {
        if (stopped || motion.matches) return;
        scope = createScope({ root: section }).add(() => {
          animate('.atelier-hero-display', { opacity: [0.75, 1], y: [12, 0], duration: 600 });
        });
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
  }, []);

  return (
    <section className="atelier-hero" ref={root}>
      <div className="atelier-hero-display">
        <p className="atelier-label">{shopper ? 'A neighbourhood shop, brought closer' : 'One stock ledger'}</p>
        <h2 className="atelier-heading">{shopper ? <>Good things.<br /><em>Close to home.</em></> : <>Every counter.<br /><em>In sync.</em></>}</h2>
        <p>{shopper
          ? 'Discover the shelves at your chosen branch, save the last one for your basket, and know exactly where it is waiting.'
          : 'Online reservations and counter sales draw from the same branch inventory.'}</p>
        <Link href={shopper ? '/#market' : '/ops/inventory'} className="atelier-action">
          {shopper ? 'Explore the market' : 'Explore inventory'} <Icon name="arrow" size={16} />
        </Link>
      </div>
      <div className="atelier-hero-art" aria-hidden="true">
        <MechanismPoster />
        <span className="atelier-hero-notes atelier-label">CartLock / one allocation</span>
        {scene && <div className="atelier-canvas"><SceneBoundary><SpatialScene progress={progress} /></SceneBoundary></div>}
      </div>
    </section>
  );
}

export function AtelierHero() {
  return <RetailPulse shopper />;
}
