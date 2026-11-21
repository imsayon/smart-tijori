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

  // Purely derived from current props and ticker — eliminates all state sync issues
  const timerState = calculateHoldRemaining(expiresAt, serverNow, now);

  // Notify parent exactly once per hold lifecycle when expired
  useEffect(() => {
    if (timerState.isExpired && notifiedExpiredKeyRef.current !== currentHoldKey) {
      notifiedExpiredKeyRef.current = currentHoldKey;
      onExpire?.();
    }
  }, [timerState.isExpired, currentHoldKey, onExpire]);

  const isLowTime = timerState.remainingSeconds <= 15 && !timerState.isExpired;

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full border font-mono text-xs sm:text-sm font-black shadow-xs transition-all duration-200 ${
        timerState.isExpired
          ? 'bg-rose-50 text-rose-800 border-rose-300'
          : isLowTime
          ? 'bg-amber-50 text-amber-950 border-amber-400 animate-pulse ring-2 ring-amber-400/30'
          : 'bg-[#F4F0E8] text-[#0E2A22] border-[#C89B3C]/50 hover:border-[#C89B3C]'
      } ${className}`}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
            timerState.isExpired ? 'bg-rose-500' : isLowTime ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-ping'
          }`}
        />
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            timerState.isExpired ? 'bg-rose-600' : isLowTime ? 'bg-amber-600' : 'bg-emerald-600'
          }`}
        />
      </span>
      <span className="tracking-tight">
        {timerState.isExpired ? 'Hold Expired' : `Stock reserved: ${timerState.formattedTime}`}
      </span>
    </div>
  );
}
