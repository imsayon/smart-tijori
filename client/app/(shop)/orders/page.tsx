import { cookies } from 'next/headers';
import Link from 'next/link';
import { readAccount, shopperId } from '@server/http/auth/firebase-session';
import { getCommerceDatabase } from '@server/db/runtime';
import { formatPaise } from '@/lib/utils/currency';

export default async function OrdersPage() {
  const user = await readAccount((await cookies()).toString());
  if (!user) return <Link className="atelier-action" href="/account">Sign in to view orders</Link>;

  const { rows } = await getCommerceDatabase().transact(client => client.query<{
    reservation_id: string; order_id: string | null; total: number; branch: string; paid: boolean; date: Date;
  }>(`SELECT r.id AS reservation_id, o.id AS order_id, r.total_paise AS total, s.name AS branch,
      (o.payment_mode = 'RAZORPAY') AS paid, COALESCE(o.created_at, p.created_at) AS date
    FROM reservations r JOIN carts c ON c.id = r.cart_id JOIN stores s ON s.id = r.store_id
    LEFT JOIN orders o ON o.reservation_id = r.id
    LEFT JOIN payment_attempts p ON p.reservation_id = r.id AND p.owner_id = c.owner_id
    WHERE c.owner_id = $1 AND (o.id IS NOT NULL OR p.reservation_id IS NOT NULL)
    ORDER BY date DESC, r.id DESC LIMIT 50`, [shopperId(user.uid)]));

  return <section className="space-y-5">
    <h1 className="atelier-heading text-5xl">Your orders</h1>
    {!rows.length && <p>Your orders and payment attempts will appear here.</p>}
    <ul className="divide-y divide-[#dcd6c9]">
      {rows.map(row => <li className="py-4" key={row.reservation_id}>
        <Link className="underline" href={row.order_id ? `/orders/${row.order_id}` : `/checkout/status/${row.reservation_id}`}>
          {row.order_id ? row.paid ? 'Confirmed order' : 'Simulated order' : 'Payment attempt'}
          {' · '}{row.branch}{' · '}{formatPaise(row.total)}
        </Link>
        <time className="block text-sm" dateTime={row.date.toISOString()}>{row.date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</time>
      </li>)}
    </ul>
  </section>;
}
