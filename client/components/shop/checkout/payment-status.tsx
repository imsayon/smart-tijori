'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/session/store-context';

type Status = { orderId: string | null; refundStatus: 'pending' | 'processed' | 'failed' | null; active: boolean; canRetry: boolean };

export function PaymentStatus({ reservationId }: { reservationId: string }) {
  const [status, setStatus] = useState<Status>();
  const [error, setError] = useState('');
  const { refreshCart } = useStore();
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      let terminal = false;
      try {
        const response = await fetch(`/api/payments/${encodeURIComponent(reservationId)}`, {
          cache: 'no-store', signal: controller.signal,
        });
        if (response.status === 404 || response.status === 401) {
          setError(response.status === 404 ? 'No payment attempt was found.' : 'Sign in to view your payment.');
          return;
        }
        if (!response.ok) throw new Error('Payment status unavailable');
        const result: Status = await response.json();
        setError('');
        setStatus(result);
        terminal = Boolean(result.orderId || result.refundStatus === 'processed' || result.refundStatus === 'failed');
        if (result.orderId) await refreshCart();
      } catch {
        if (!controller.signal.aborted) setError('Payment status is temporarily unavailable. Checking again shortly.');
      }
      if (!terminal && !controller.signal.aborted) timer = setTimeout(load, 3000);
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [reservationId, refreshCart]);

  const title = status?.orderId ? 'Order confirmed' : status?.refundStatus === 'processed' ? 'Payment refunded'
    : status?.refundStatus === 'failed' ? 'Refund needs attention' : status?.refundStatus === 'pending' ? 'Refund pending'
      : status?.canRetry ? 'No payment captured' : 'Checking payment';

  return (
    <section className="mx-auto max-w-xl space-y-5">
      <h1 className="atelier-heading text-5xl">{title}</h1>
      {error && <p role="alert">{error}</p>}
      {status?.orderId && <Link className="atelier-action" href={`/orders/${status.orderId}`}>View order</Link>}
      {status?.canRetry && <Link className="atelier-action" href="/checkout">Return to checkout</Link>}
      {!status?.orderId && !status?.refundStatus && !status?.canRetry && !error &&
        <p role="status">We’re waiting for the payment provider. Your attempt stays in your account if you leave this page.</p>}
      {status?.refundStatus === 'pending' && <p role="status">The reservation ended before the payment could be applied. We’re returning it to your original payment method.</p>}
      <Link className="block underline" href="/orders">View order history</Link>
    </section>
  );
}
