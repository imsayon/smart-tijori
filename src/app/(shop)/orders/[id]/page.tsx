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
      <div className="max-w-xl mx-auto py-16 text-center text-[#78716C] animate-pulse">
        Loading order confirmation…
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#F3EFEA] text-3xl flex items-center justify-center mx-auto mb-4 border border-[#E3DDD2]">
          📄
        </div>
        <h2 className="text-2xl font-black text-[#181614] mb-2 tracking-tight">Order Not Available</h2>
        <p className="text-xs text-[#78716C] mb-6">{error ?? 'Order could not be located.'}</p>
        <Link
          href="/"
          className="bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] px-6 py-3 rounded-full font-black text-sm inline-flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
        >
          <span>Return to Catalog</span>
          <span className="text-[#F59E0B]">→</span>
        </Link>
      </div>
    );
  }

  return <SimulatedPaymentReceipt order={order} />;
}

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto py-16 text-center text-[#78716C] animate-pulse">
          Loading order details…
        </div>
      }
    >
      <OrderContent />
    </Suspense>
  );
}
