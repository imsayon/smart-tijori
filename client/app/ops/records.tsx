import Link from 'next/link';
import { getCommerceDatabase } from '@server/db/runtime';
import { formatPaise } from '@/lib/utils/currency';
import { readWorkbenchOperator } from './operator';

const PAGE_SIZE = 25;
type Line = { name: string; quantity: number; unitPricePaise: number };
type Record = { id: string; kind: string; state: string; date: Date; amount: number; lines: Line[] };

export async function OpsRecords({ kind, page }: { kind: 'orders' | 'reservations'; page: string | undefined }) {
  const { actor, fixture } = await readWorkbenchOperator();
  if (!actor?.storeId) return null;
  if (fixture) return <p>This view requires branch records from PostgreSQL.</p>;

  const offset = /^\d{1,4}$/.test(page ?? '') ? Math.max(0, Number(page) - 1) * PAGE_SIZE : 0;
  const db = getCommerceDatabase();
  const { rows } = await db.transact(client => client.query<Record>(kind === 'orders' ? `
    SELECT * FROM (
      SELECT o.id, 'Online order' AS kind, o.payment_mode AS state, o.created_at AS date, o.total_paise AS amount,
        (SELECT jsonb_agg(jsonb_build_object('name', l.name, 'quantity', l.quantity, 'unitPricePaise', l.unit_price_paise)
          ORDER BY l.product_id) FROM order_lines l WHERE l.order_id = o.id) AS lines
      FROM orders o JOIN reservations r ON r.id = o.reservation_id WHERE r.store_id = $1
      UNION ALL
      SELECT s.id, 'Counter sale', 'CONFIRMED', s.sold_at, s.total_paise, s.lines
      FROM pos_sales s WHERE s.store_id = $1
    ) branch_orders
    ORDER BY date DESC, id DESC LIMIT $2 OFFSET $3` : `
    SELECT r.id, 'CartLock' AS kind, CASE
      WHEN r.status = 'ACTIVE' AND r.expires_at <= clock_timestamp() THEN 'EXPIRED'
      ELSE r.status END AS state, r.expires_at AS date, r.total_paise AS amount,
      (SELECT jsonb_agg(jsonb_build_object('name', l.name, 'quantity', l.quantity, 'unitPricePaise', l.unit_price_paise)
        ORDER BY l.product_id) FROM reservation_lines l WHERE l.reservation_id = r.id) AS lines
    FROM reservations r WHERE r.store_id = $1
    ORDER BY r.created_at DESC, r.id DESC LIMIT $2 OFFSET $3`,
  [actor.storeId, PAGE_SIZE + 1, offset]));

  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  return <section className="space-y-5">
    <header><h1 className="atelier-heading text-5xl">{kind === 'orders' ? 'Orders' : 'Reservations'}</h1><p className="mt-2">{actor.storeId}</p></header>
    {!rows.length && <p>{kind === 'orders' ? 'No orders or counter sales on this page.' : 'No reservations on this page.'}</p>}
    <div className="divide-y divide-[#dcd6c9] border-y border-[#dcd6c9]">
      {rows.slice(0, PAGE_SIZE).map(record => <details key={record.id} className="p-3">
        <summary className="cursor-pointer">
          <span className="ml-2 font-semibold">{record.kind}</span>{' · '}
          {record.state === 'RAZORPAY' ? 'Confirmed' : record.state.toLowerCase()}{' · '}{formatPaise(record.amount)}
          {' · '}<time dateTime={record.date.toISOString()}>{record.date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</time>
        </summary>
        <p className="break-all py-2 font-mono text-xs">{record.id}</p>
        <ul>{record.lines?.map((line, index) => <li key={index}>{line.quantity} × {line.name} · {formatPaise(line.unitPricePaise)}</li>)}</ul>
      </details>)}
    </div>
    <nav aria-label={`${kind} pages`} className="flex gap-4">
      {pageNumber > 1 && <Link className="underline" href={`/ops/${kind}?page=${pageNumber - 1}`}>Previous page</Link>}
      {rows.length > PAGE_SIZE && <Link className="underline" href={`/ops/${kind}?page=${pageNumber + 1}`}>Next page</Link>}
    </nav>
  </section>;
}
