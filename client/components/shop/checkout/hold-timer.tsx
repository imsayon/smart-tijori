import { calculateHoldRemaining } from '@/lib/checkout/timer';
import React, { useEffect, useState, useRef } from 'react';
import { CartLockDial } from './cartlock-dial';

interface HoldTimerProps {
  expiresAt: string;
  serverNow: string;
  onExpire?: () => void;
  className?: string;
}

export function HoldTimer({ expiresAt, serverNow, onExpire, className = '' }: HoldTimerProps) {
  const [now, setNow] = useState<number>(() => Date.now());
  const notifiedExpiredKeyRef = useRef<string | null>(null);

  const currentHoldKey = `${expiresAt}::${serverNow}`;

  // Track the client arrival timestamp for the current hold to compensate for clock skew.
  // When hold identity or timing information changes, reset baseline to current client time.
  const [holdBaseline, setHoldBaseline] = useState(() => ({
    key: currentHoldKey,
    receivedAt: Date.now(),
  }));

  if (holdBaseline.key !== currentHoldKey) {
    setHoldBaseline({
      key: currentHoldKey,
      receivedAt: now,
    });
  }

  const effectiveReceivedAt =
    holdBaseline.key === currentHoldKey ? holdBaseline.receivedAt : now;

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const interval = setInterval(updateNow, 1000);

    // Re-sync immediately on tab resume / browser focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', updateNow);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', updateNow);
    };
  }, []);

  // Derived from current props, ticker, and client arrival baseline for exact skew compensation
  const timerState = calculateHoldRemaining(
    expiresAt,
    serverNow,
    now,
    effectiveReceivedAt
  );

  // Notify parent exactly once per hold lifecycle when expired
  useEffect(() => {
    if (timerState.isExpired && notifiedExpiredKeyRef.current !== currentHoldKey) {
      notifiedExpiredKeyRef.current = currentHoldKey;
      onExpire?.();
    }
  }, [timerState.isExpired, currentHoldKey, onExpire]);

  const isLowTime = timerState.remainingSeconds <= 15 && !timerState.isExpired;

  return (
    <div className={`st-live-hold-timer ${className}`} data-urgent={isLowTime || timerState.isExpired}>
      <CartLockDial seconds={timerState.remainingSeconds}
        mode={timerState.isExpired ? 'expired' : 'active'} compact />
      <div className="st-live-hold-copy" role="timer" aria-live="off">
        <span className="st-kicker">{timerState.isExpired ? 'WINDOW CLOSED' : isLowTime ? 'FINISH YOUR CHECKOUT' : 'STOCK PROTECTED'}</span>
        <strong>{timerState.isExpired ? 'Hold Expired' : `Stock reserved: ${timerState.formattedTime}`}</strong>
        <span>{timerState.isExpired ? 'Reserve again to continue.' : 'This countdown is tied to your actual reservation.'}</span>
      </div>
    </div>
  );
}
