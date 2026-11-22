import type { Hold } from '@/contracts';
import { Icon } from '@/components/ui/atelier';
import { formatPaise } from '@/lib/utils/currency';
import { HoldTimer } from '../checkout/hold-timer';

interface HoldStatusCardProps {
  hold: Hold;
  onExpire?: () => void;
}

export function HoldStatusCard({ hold, onExpire }: HoldStatusCardProps) {
  return (
    <section className="st-hold-card" aria-label="Current checkout reservation">
      <div className="st-hold-top">
        <div>
          <p className="st-kicker"><span className="st-live-dot" /> SECURE CHECKOUT / STOCK ALLOCATION</p>
          <h2>CartLock Reservation</h2>
          <span className="st-hold-id">{hold.id}</span>
        </div>
        <span className="st-hold-status"><Icon name="lock" size={13}/> {hold.status === 'ACTIVE' ? 'HOLD ACTIVE' : hold.status}</span>
      </div>
      {hold.status === 'ACTIVE' && <div className="st-hold-timer-panel">
        <HoldTimer expiresAt={hold.expiresAt} serverNow={hold.serverNow} onExpire={onExpire}/>
      </div>}
      <div className="st-hold-items">
        <div className="st-hold-items-header"><span className="st-kicker">ITEMS IN THIS RESERVATION</span><span>{hold.lines.length} LINES</span></div>
        {hold.lines.map(line => <div className="st-hold-item" key={line.productId}>
          <span>{line.name} <small>× {line.quantity}</small></span>
          <strong>{formatPaise(line.unitPricePaise * line.quantity)}</strong>
        </div>)}
      </div>
      <footer className="st-hold-total">
        <span>Amount to confirm</span>
        <strong>{formatPaise(hold.totalPaise)}</strong>
      </footer>
    </section>
  );
}
