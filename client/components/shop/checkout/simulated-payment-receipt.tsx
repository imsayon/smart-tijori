'use client';

import Link from 'next/link';
import type { Order } from '@/contracts';
import { Icon } from '@/components/ui/atelier';
import { formatPaise } from '@/lib/utils/currency';

interface SimulatedPaymentReceiptProps { order: Order }

export function SimulatedPaymentReceipt({ order }: SimulatedPaymentReceiptProps) {
  const simulated = order.paymentMode === 'SIMULATED';

  return <section className="st-receipt" aria-labelledby="st-receipt-title">
    <header className="st-receipt-hero">
      <div className="st-receipt-check" aria-hidden="true"><Icon name="check" size={37}/></div>
      <p className="st-kicker">PURCHASE COMPLETE / YOUR NEIGHBOURHOOD</p>
      <h1 id="st-receipt-title">Order Confirmed!</h1>
      <p>Your local picks are now part of your order history.</p>
      <span className="st-receipt-reference">{order.id}</span>
      <div className="st-receipt-lines-art" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/></div>
    </header>

    {simulated && <div className="st-receipt-notice">
      <strong>SIMULATED PAYMENT</strong><span>Mode: {order.paymentMode}</span>
      <p>This purchase uses a simulated payment. No card or bank account has been charged.</p>
    </div>}

    <div className="st-receipt-content">
      <div className="st-receipt-meta">
        <div><span>RESERVATION</span><strong>{order.reservationId}</strong></div>
        <div><span>YOUR STORE</span><strong>{order.storeId}</strong></div>
        <div><span>CONFIRMED AT</span><strong>{new Date(order.createdAt).toLocaleString()}</strong></div>
        <div><span>ORDER STATUS</span><strong>{order.status}</strong></div>
      </div>
      <div className="st-receipt-items">
        <p className="st-kicker">YOUR COLLECTION</p>
        {order.lines.map(line=><div key={line.productId}>
          <div><strong>{line.name}</strong><small>{formatPaise(line.unitPricePaise)} × {line.quantity}</small></div>
          <b>{formatPaise(line.unitPricePaise * line.quantity)}</b>
        </div>)}
      </div>
      <div className="st-receipt-total">
        <span>{simulated ? 'Total Paid (Simulated)' : 'Total Paid'}</span>
        <strong>{formatPaise(order.totalPaise)}</strong>
      </div>
      <div className="st-receipt-actions">
        <Link href="/orders" className="st-primary-cta">Your orders <Icon name="arrow" size={18}/></Link>
        <Link href="/search" className="st-text-link">Keep exploring <Icon name="upRight" size={16}/></Link>
      </div>
    </div>
  </section>;
}
