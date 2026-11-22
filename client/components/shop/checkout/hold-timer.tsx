import { calculateHoldRemaining } from '@/lib/checkout/timer';
import React, { useEffect, useState, useRef } from 'react';

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
  const durationSeconds = Math.max(1, (Date.parse(expiresAt) - Date.parse(serverNow)) / 1000);
  const progress = Math.max(0, Math.min(1, timerState.remainingSeconds / durationSeconds));
  const circumference = 2 * Math.PI * 82;

  return <div role="timer" aria-live="off"
    data-low-time={isLowTime} data-expired={timerState.isExpired}
    className={`st-hold-timer ${className}`}>
    <div className="st-hold-clockface">
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <circle className="st-hold-track" cx="110" cy="110" r="82"/>
        <circle className="st-hold-ticks" cx="110" cy="110" r="98"/>
        <circle className="st-hold-progress" cx="110" cy="110" r="82"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}/>
        <circle cx="110" cy="12" r="3" className="st-hold-pip"/>
      </svg>
      <div className="st-hold-clockface-inner" aria-hidden="true">
        <span className="st-hold-number">{timerState.formattedTime}</span>
        <small>{timerState.isExpired ? 'TIME ELAPSED' : 'REMAINING'}</small>
      </div>
    </div>
    <div className="st-hold-time-copy">
      <span className="st-overline">{timerState.isExpired ? 'CARTLOCK / EXPIRED' : 'CARTLOCK / ACTIVE'}</span>
      <strong>{timerState.isExpired ? 'Hold Expired' : `Stock reserved: ${timerState.formattedTime}`}</strong>
      <p>{timerState.isExpired ? 'Recheck stock to continue.' : 'Your stock is protected until the deadline shown.'}</p>
    </div>
  </div>;
}
