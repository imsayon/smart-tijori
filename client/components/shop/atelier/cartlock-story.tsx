'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/atelier';

const SpatialScene = dynamic(() => import('./spatial-scene'), { ssr: false });
const chapters = [
  { label: 'Choose a branch', title: <>Start with<br /><em>the right shelf.</em></>, copy: 'Availability belongs to the branch you choose. Browse what is held there, and keep your basket tied to that store.' },
  { label: 'Reserve with CartLock', title: <>One unit.<br /><em>One promise.</em></>, copy: 'CartLock asks the inventory authority to reserve each item. The browser never decides whether the last unit is yours.' },
  { label: 'Check out securely', title: <>A clear path<br /><em>to checkout.</em></>, copy: 'Your reservation stays visible while you complete payment. A signed provider response is checked by the server before the order is confirmed.' },
  { label: 'Recover without a dead end', title: <>If stock changes,<br /><em>keep moving.</em></>, copy: 'When another shopper or cashier claims the last unit, ZeroDeadEnd returns the available choices and keeps recovery in the journey.' },
];

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export function CartLockStory() {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = root.current;
    if (!section) return;
    const steps = [...section.querySelectorAll<HTMLElement>('[data-story-step]')];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const visibility = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && !motion.matches), { rootMargin: '160px' });
    const chapterVisibility = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const index = Number((entry.target as HTMLElement).dataset.storyStep);
          setActive(index);
          (entry.target as HTMLElement).dataset.inView = 'true';
          if (!motion.matches) {
            void import('animejs').then(({ animate }) => {
              animate(entry.target, {
                opacity: [0.4, 1],
                translateY: [18, 0],
                duration: 520,
                ease: 'outQuad',
              });
            }).catch(() => {});
          }
        }
      }
    }, { threshold: 0.38 });
    visibility.observe(section);
    steps.forEach(step => chapterVisibility.observe(step));
    const updateProgress = () => {
      const range = Math.max(1, section.offsetHeight - window.innerHeight);
      setProgress(Math.max(0, Math.min(1, -section.getBoundingClientRect().top / range)));
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    updateProgress();
    return () => {
      visibility.disconnect();
      chapterVisibility.disconnect();
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, []);

  function goToChapter(index: number) {
    root.current?.querySelector<HTMLElement>(`[data-story-step="${index}"]`)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center',
    });
  }

  return <section id="stock" className="atelier-cartlock-story" ref={root} aria-label="How a local order stays in sync">
    <div className="atelier-story-stage">
      <div className="atelier-story-heading">
        <p className="atelier-label">The last one protocol &nbsp; / &nbsp; {String(active + 1).padStart(2, '0')} — 04</p>
        <p className="atelier-story-step">{chapters[active].label}</p>
      </div>
      <div className="atelier-story-model" aria-hidden="true">
        <MechanismDrawing />
        {visible && <div className="atelier-story-canvas"><SceneBoundary><SpatialScene mode="story" progress={progress} interactive /></SceneBoundary></div>}
      </div>
      <div className="atelier-story-stage-foot">
        <span>CartLock / one stock authority</span>
        <div aria-hidden="true" className="atelier-story-progress"><i style={{ transform: `scaleX(${progress})` }} /></div>
      </div>
      <nav className="atelier-story-dots" aria-label="Stock journey chapters">
        {chapters.map((chapter, index) => <button type="button" key={chapter.label} aria-label={`Go to: ${chapter.label}`}
          aria-current={active === index ? 'step' : undefined} onClick={() => goToChapter(index)} />)}
      </nav>
    </div>
    <div className="atelier-story-chapters">
      {chapters.map((chapter, index) => <article className="atelier-story-chapter" data-story-step={index} key={chapter.label}>
        <p className="atelier-label">0{index + 1} &nbsp; / &nbsp; {chapter.label}</p>
        <h2 className="atelier-heading">{chapter.title}</h2>
        <p>{chapter.copy}</p>
        {index === 0 && <Link className="atelier-secondary" href="/stores">Find your branch <Icon name="arrow" size={15} /></Link>}
        {index === 1 && <Link className="atelier-secondary" href="/#market">Browse the market <Icon name="arrow" size={15} /></Link>}
        {index === 2 && <Link className="atelier-secondary" href="/cart">View your basket <Icon name="arrow" size={15} /></Link>}
        {index === 3 && <Link className="atelier-secondary" href="/orders">See your orders <Icon name="arrow" size={15} /></Link>}
      </article>)}
    </div>
  </section>;
}

function MechanismDrawing() {
  return <svg className="atelier-story-poster" viewBox="0 0 560 410" fill="none">
    <ellipse cx="280" cy="224" rx="229" ry="102" transform="rotate(-12 280 224)" stroke="#a9bf8b" opacity=".34" />
    <ellipse cx="280" cy="224" rx="189" ry="81" transform="rotate(-12 280 224)" stroke="#d4e992" opacity=".23" />
    {Array.from({ length: 64 }, (_, index) => {
      const theta = (index / 64) * 2 * Math.PI;
      const x = Math.cos(theta);
      const y = Math.sin(theta);
      const px = (value: number) => value.toFixed(2);
      return <path key={index} d={`M ${px(280 + x * 163)} ${px(224 + y * 72)} L ${px(280 + x * 211)} ${px(224 + y * 94)}`}
        transform="rotate(-12 280 224)" stroke={index % 4 === 0 ? '#d4e992' : '#92ad7e'} strokeWidth="5" opacity={y > 0 ? '.8' : '.42'} />;
    })}
    <path d="M 196 149 L 294 117 L 365 148 L 269 181 Z" fill="#789272" stroke="#aec393" />
    <path d="M 196 149 L 269 181 L 269 281 L 196 250 Z" fill="#4e7258" stroke="#91ae83" />
    <path d="M 269 181 L 365 148 L 365 250 L 269 281 Z" fill="#31543f" stroke="#789272" />
    <text x="292" y="214" fill="#d8e7cc" fontSize="18" fontFamily="monospace">01</text>
  </svg>;
}
