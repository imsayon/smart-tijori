import type { Hold } from '@/contracts';
import { formatPaise } from '@/lib/utils/currency';
import { Icon } from '@/components/ui/atelier';
import { HoldTimer } from '../checkout/hold-timer';

interface HoldStatusCardProps {
  hold: Hold;
  onExpire?: () => void;
}

export function HoldStatusCard({ hold, onExpire }: HoldStatusCardProps) {
  return <section className="st-active-hold">
    <div className="st-active-hold-top">
      <div>
        <p className="st-overline"><span className="st-mini-dot"/> LIVE HOLD / 02</p>
        <h2 className="st-active-hold-title">A moment, <em>just for you.</em></h2>
        <p>Checkout has reserved the stock below for a finite window. Your payment must complete before it ends.</p>
        <div className="st-hold-id"><Icon name="lock" size={14}/><span>CartLock Reservation</span> <code>{hold.id}</code></div>
      </div>
      {hold.status === 'ACTIVE' ? <HoldTimer key={hold.id} expiresAt={hold.expiresAt}
        serverNow={hold.serverNow} onExpire={onExpire}/> :
        <p className="st-overline">STATUS / {hold.status}</p>}
    </div>
    <div className="st-active-hold-products">
      <div className="st-active-hold-header"><span className="st-overline">RESERVED PRODUCTS</span><span className="st-overline">THIS BRANCH / {hold.storeId}</span></div>
      {hold.lines.map(line => <div key={line.productId} className="st-active-hold-line">
        <span>{line.name} <small>× {line.quantity}</small></span>
        <strong>{formatPaise(line.unitPricePaise * line.quantity)}</strong>
      </div>)}
      <div className="st-active-hold-total"><span>Hold total</span><strong>{formatPaise(hold.totalPaise)}</strong></div>
    </div>
  </section>;
}
