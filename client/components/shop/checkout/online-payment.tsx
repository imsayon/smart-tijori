'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPaise } from '@/lib/utils/currency';
import { Icon } from '@/components/ui/atelier';

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
    <section className="st-payment-provider" aria-labelledby="st-pay-title">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive"
        onReady={() => setReady(true)} onError={() => setMessage('The payment window could not load. Reload to try again.')} />
      <div className="st-payment-provider-head">
        <div><p className="st-kicker">THE FINAL STEP / PAYMENT</p>
          <h2 id="st-pay-title">Ready to make<br/><em>it yours?</em></h2>
          <p>Complete payment before your reservation window closes. We’ll confirm your order once payment is verified.</p>
        </div>
        <span className="st-pay-padlock"><Icon name="lock" size={25}/></span>
      </div>
      <div className="st-payment-provider-amount">
        <div><span className="st-kicker">TOTAL DUE</span><strong>{formatPaise(amount)}</strong></div>
        <span className="st-payment-provider-brand"><Icon name="check" size={14}/> Secure payment</span>
      </div>
      {testMode && <p className="st-pay-test">Test payment · No real money will move.</p>}
      <button type="button" disabled={!ready || busy} className="st-primary-cta st-pay-button" onClick={() => void pay()}>
        {busy ? 'Opening checkout…' : !ready ? 'Preparing secure payment…' : `Pay ${formatPaise(amount)}`} <Icon name="arrow" size={17}/>
      </button>
      <Link className="st-payment-status-link" href={`/checkout/status/${reservationId}`}>Check payment status <Icon name="upRight" size={15}/></Link>
      {message && <p role="alert" className="st-pay-error">{message}</p>}
    </section>
  );
}
