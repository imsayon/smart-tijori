'use client';

import { useEffect, useState } from 'react';
import { CartLockDial } from './cartlock-dial';
import { QrCode } from '@/components/ui/qr-code';

const DURATION_MS = 59_000;

/**
 * Visual preview for the checkout gate. It has no connection to inventory,
 * reservations or fulfilment, and cannot issue a valid collection credential.
 * Real reservation countdowns are derived from PostgreSQL timestamps elsewhere.
 */
export function CheckoutDialPreview() {
  const [endAt] = useState(() => Date.now() + DURATION_MS);
  const [remaining, setRemaining] = useState(59);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    const interval = window.setInterval(tick, 200);
    const onResume = () => tick();
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [endAt]);

  const finished = remaining === 0;
  const qrUrl = `${(process.env.NEXT_PUBLIC_ST_SITE_ORIGIN || 'https://smart-tijori.onrender.com').replace(/[/]$/, '')}/ops`;

  return <div className="st-checkout-dial-preview" data-complete={finished}>
    <div className="st-checkout-dial-face">
      <div className="st-checkout-dial-layer" data-visible={!finished}>
        <CartLockDial seconds={remaining} mode="active"/>
      </div>
      <div className="st-checkout-qr-layer" data-visible={finished} aria-hidden={!finished}>
        {finished && <div className="st-checkout-qr-paper">
          <QrCode value={qrUrl} label="Demo QR opening the SmartTijori merchant workspace; this is not an order collection pass" size={175}/>
          <span>SMARTTIJORI / PARTNER VIEW</span>
        </div>}
      </div>
    </div>
    <div className="st-checkout-dial-caption" aria-live="polite">
      {finished
        ? <><strong>SCAN TO OPEN PARTNER VIEW</strong><span>Preview code only · No order or stock reserved</span></>
        : <><strong>59-SECOND EXPERIENCE PREVIEW</strong><span>The dial flips into a scannable QR at 00:00</span></>}
    </div>
  </div>;
}
