'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPaise } from '@/lib/utils/currency';

type CheckoutOptions = {
  key: string; order_id: string; amount: number; currency: string; name: string;
  prefill: { email: string }; timeout: number; handler: () => void; modal: { ondismiss: () => void };
};

export function OnlinePayment({ reservationId, amount, expiresAt, serverNow, testMode }: {
  reservationId: string; amount: number; expiresAt: string; serverNow: string; testMode: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const [openedAt] = useState(() => Date.now());

  async function pay() {
    setBusy(true);
    setMessage('');
    const statusUrl = `/checkout/status/${reservationId}`;
    try {
      const response = await fetch(`/api/payments/${reservationId}`, { method: 'POST' });
      if (!response.ok) {
        const result = await response.json();
        setMessage(result.error?.message ?? 'Could not start checkout.');
        return;
      }
      const checkout = await response.json();
      const timeout = Math.floor((Date.parse(expiresAt) - Date.parse(serverNow) - (Date.now() - openedAt)) / 1000);
      const Razorpay = (window as Window & { Razorpay?: new (opts: CheckoutOptions) => { open(): void } }).Razorpay;
      if (!Razorpay || timeout < 1) {
        router.push(statusUrl);
        return;
      }
      new Razorpay({
        key: checkout.key, order_id: checkout.providerOrderId, amount: checkout.amount,
        currency: checkout.currency, name: 'SmartTijori', prefill: { email: checkout.email }, timeout,
        handler: () => router.push(statusUrl),
        modal: { ondismiss: () => router.push(statusUrl) },
      }).open();
    } catch {
      setMessage('Could not reach payment checkout. Check the payment status before trying again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 border border-[#dcd6c9] bg-[#faf7f0] p-5">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive"
        onReady={() => setReady(true)} onError={() => setMessage('The payment window could not load. Reload to try again.')} />
      <h2 className="atelier-heading text-3xl">Pay online</h2>
      {testMode && <p className="text-sm">Razorpay Test Mode. No money will move.</p>}
      <button type="button" disabled={!ready || busy} className="atelier-action" onClick={() => void pay()}>
        {busy ? 'Opening checkout…' : `Pay ${formatPaise(amount)}`}
      </button>
      <Link className="block text-sm underline" href={`/checkout/status/${reservationId}`}>Check payment status</Link>
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
