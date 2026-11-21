'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Order } from '@/contracts';
import { api } from '@/lib/api-client';
import { SimulatedPaymentReceipt } from '@/components/shop/checkout/simulated-payment-receipt';

function OrderContent() {
  const params = useParams();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchOrder() {
      try {
        setIsLoading(true);
        const res = await api.getOrder(orderId);
        if (active) {
          setOrder(res);
        }
      } catch {
        if (active) {
          setError('Order not found or not visible to your current session.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    if (orderId) {
      fetchOrder();
    }
    return () => {
      active = false;
    };
  }, [orderId]);

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center text-stone-500 animate-pulse">
        Loading order confirmation…
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="text-4xl mb-3">📄</div>
        <h2 className="text-xl font-bold text-stone-900 mb-2">Order Not Available</h2>
        <p className="text-xs text-stone-500 mb-6">{error ?? 'Order could not be located.'}</p>
        <Link
          href="/"
          className="bg-[#173F35] text-white px-5 py-2.5 rounded-xl font-bold text-sm inline-block"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6">
      <SimulatedPaymentReceipt order={order} />
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto py-16 text-center text-stone-500">Loading order…</div>}>
      <OrderContent />
    </Suspense>
  );
}
