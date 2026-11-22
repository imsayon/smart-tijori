import type { CSSProperties } from 'react';

type CartLockDialProps = {
  seconds?: number;
  mode?: 'preview' | 'active' | 'expired';
  compact?: boolean;
};

const RADIUS = 84;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * One visual language for the cart's non-active preview and the
 * checkout's real, server-timestamp-derived reservation countdown.
 * This component has no timer or API effects of its own.
 */
export function CartLockDial({ seconds = 59, mode = 'preview', compact = false }: CartLockDialProps) {
  const remaining = Math.max(0, Math.min(59, Math.ceil(Number.isFinite(seconds) ? seconds : 0)));
  const progress = mode === 'preview' ? 1 : remaining / 59;
  const time = `00:${String(remaining).padStart(2, '0')}`;
  const style = { '--st-dial-progress': CIRCUMFERENCE * (1 - progress) } as CSSProperties;

  return (
    <div className={`st-dial ${compact ? 'st-dial-compact' : ''}`} data-mode={mode} style={style}>
      <div className="st-dial-orbit" aria-hidden="true"><span/><span/><span/><span/></div>
      <svg className="st-dial-svg" viewBox="0 0 220 220" aria-hidden="true">
        <circle className="st-dial-track" cx="110" cy="110" r={RADIUS} />
        <circle className="st-dial-progress" cx="110" cy="110" r={RADIUS}
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - progress)} />
        <circle className="st-dial-inside" cx="110" cy="110" r="69" />
      </svg>
      <div className="st-dial-center">
        <span className="st-dial-eyebrow">{mode === 'preview' ? 'UPON CHECKOUT' : mode === 'active' ? 'RESERVED FOR' : 'TIME ELAPSED'}</span>
        <span className="st-dial-time">{time}</span>
        <span className="st-dial-unit">MIN : SEC</span>
      </div>
    </div>
  );
}
