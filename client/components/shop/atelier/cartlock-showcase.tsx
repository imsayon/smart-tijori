'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { QrCode } from '@/components/ui/qr-code';

const DURATION_SECONDS = 59;

/**
 * Editorial showcase only. Starts when visible and counts from 59 to zero.
 * It does NOT create or expire inventory holds; real CartLock uses server timestamps.
 */
export function CartLockShowcase() {
  const root = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [remaining, setRemaining] = useState(DURATION_SECONDS);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      const trigger = window.setTimeout(() => setStarted(true), 0);
      return () => window.clearTimeout(trigger);
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setStarted(true);
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const endAt = Date.now() + DURATION_SECONDS * 1000;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    }, 200);
    return () => window.clearInterval(timer);
  }, [started]);

  const ended = remaining === 0;
  const previewUrl = `${(process.env.NEXT_PUBLIC_ST_SITE_ORIGIN || 'https://smart-tijori.onrender.com').replace(/[/]$/, '')}/checkout`;

  return (
    <div className="ga-clock ga-reveal" ref={root}
      aria-label="Interactive illustration of the 59-second checkout countdown">
      <span className="ga-clock-top">{ended ? 'THE NEXT STEP' : 'THE RESERVATION WINDOW'}</span>
      <div className={`ga-clock-rings ${ended ? 'ga-clock-complete' : ''}`}>
        <i/><i/><i/>
        {ended
          ? <div className="ga-clock-preview">
            <QrCode value={previewUrl} size={158} label="Demonstration QR linking to checkout, not a pickup credential"/>
            <span>CHECKOUT PREVIEW · NOT A PICKUP PASS</span>
          </div>
          : <div role="timer" aria-live="off" aria-label={`${remaining} seconds remaining in the demonstration`}>
            <strong>{String(remaining).padStart(2, '0')}</strong><span>SECONDS</span>
          </div>}
      </div>
      <div className="ga-clock-caption">
        {ended ? <>
          <span>EXAMPLE QR · NO ACTUAL STOCK HELD</span>
          <Link href="/checkout">Start a real checkout to receive a verified order QR</Link>
        </> : <>
          <span>STARTS WHEN THIS SECTION ENTERS VIEW</span>
          <span>ILLUSTRATIVE CLOCK · NOT A LIVE RESERVATION COUNTDOWN</span>
        </>}
      </div>
    </div>
  );
}
