import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCommerceDatabase } from '@server/db/runtime';
import { readWorkbenchOperator } from '../../operator';
import { formatPaise } from '@/lib/utils/currency';
import { Icon } from '@/components/ui/atelier';

type OrderLine = { name: string; quantity: number; unitPricePaise: number };
type VerifiedOrder = {
  id: string;
  storeId: string;
  paymentMode: 'SIMULATED' | 'RAZORPAY';
  createdAt: Date;
  totalPaise: number;
  lines: OrderLine[] | null;
};

/**
 * QR target for branch staff. Order IDs only act as locators, not bearer credentials:
 * the auth gate checks the staff's independently verified branch membership.
 * Scanning never records a handoff or changes stock.
 */
export default async function VerifyOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, fixture } = await readWorkbenchOperator();
  if (!actor?.storeId) {
    return <section className="st-verify-page">
      <p className="atelier-label">STAFF VERIFICATION / ACCESS REQUIRED</p>
      <h1 className="atelier-heading">For your store,<br/><em>and your store only.</em></h1>
      <p>Sign in as an authorized branch operator to verify a shopper&apos;s order QR.</p>
      <Link href="/ops" className="atelier-action">Go to merchant sign-in <Icon name="arrow" size={16}/></Link>
    </section>;
  }
  if (fixture) return <section className="st-verify-page">
    <p className="atelier-label">DEMONSTRATION MODE</p><h1 className="atelier-heading">Scanner preview only.</h1>
    <p>Demo mode does not validate a real order against PostgreSQL. Use an authorized live merchant account for verification.</p>
    <Link href="/ops/orders" className="atelier-secondary">Back to orders</Link>
  </section>;

  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) notFound();

  const db = getCommerceDatabase();
  const record = await db.transact(async client => {
    const { rows } = await client.query<VerifiedOrder>(`
      SELECT o.id, r.store_id AS "storeId", o.payment_mode AS "paymentMode",
        o.created_at AS "createdAt", o.total_paise AS "totalPaise",
        (SELECT jsonb_agg(jsonb_build_object('name', l.name, 'quantity', l.quantity,
          'unitPricePaise', l.unit_price_paise) ORDER BY l.product_id)
          FROM order_lines l WHERE l.order_id = o.id) AS lines
      FROM orders o JOIN reservations r ON r.id = o.reservation_id
      WHERE o.id = $1 AND r.store_id = $2
      LIMIT 1`, [id, actor.storeId]);
    return rows[0] ?? null;
  });
  if (!record) notFound();

  return <section className="st-verify-page" aria-labelledby="st-verify-heading">
    <div className="st-verify-identity"><Icon name="check" size={28}/></div>
    <p className="atelier-label">BRANCH-VERIFIED ORDER · READ ONLY</p>
    <h1 id="st-verify-heading" className="atelier-heading">Order <em>confirmed.</em></h1>
    <p>This order exists in the live database for your authorized branch. Scanning does not mark it as collected or delivered.</p>
    <dl className="st-verify-meta">
      <div><dt>Order</dt><dd className="st-verify-mono">{record.id}</dd></div>
      <div><dt>Store</dt><dd>{record.storeId}</dd></div>
      <div><dt>Confirmed</dt><dd>{new Date(record.createdAt).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'})}</dd></div>
      <div><dt>Payment</dt><dd>{record.paymentMode === 'SIMULATED' ? 'Demonstration / no actual charge' : 'Razorpay confirmed'}</dd></div>
    </dl>
    <h2>Items for this order</h2>
    <ul className="st-verify-lines">
      {(record.lines ?? []).map((line, index) => <li key={index}>
        <span>{line.quantity} × {line.name}</span><b>{formatPaise(line.unitPricePaise * line.quantity)}</b>
      </li>)}
    </ul>
    <div className="st-verify-total"><span>Order total</span><strong>{formatPaise(record.totalPaise)}</strong></div>
    <p className="st-verify-notice">Verify the shopper and physical goods before handing them over. This view does not track collection, assign a delivery partner, or authorize a second fulfilment.</p>
    <Link href="/ops/orders" className="atelier-action">Return to branch orders <Icon name="arrow" size={16}/></Link>
  </section>;
}
