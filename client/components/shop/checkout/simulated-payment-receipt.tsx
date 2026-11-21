'use client';

import React from 'react';
import Link from 'next/link';
import type { Order } from '@/contracts';
import { formatPaise } from '@/lib/utils/currency';

interface SimulatedPaymentReceiptProps {
  order: Order;
}

export function SimulatedPaymentReceipt({ order }: SimulatedPaymentReceiptProps) {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-stone-200 p-6 sm:p-10 shadow-lg text-stone-900 animate-in fade-in zoom-in-95">
      {/* Success banner */}
      <div className="text-center pb-8 border-b border-stone-200">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-emerald-300">
          ✓
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#173F35] mb-2">
          Order Confirmed!
        </h1>
        <p className="text-sm text-stone-600">
          Your reservation was atomically consumed and converted to order{' '}
          <span className="font-mono font-bold text-stone-900">{order.id}</span>.
        </p>
      </div>

      {/* Simulated Payment Notice (Mandatory per Master Plan) */}
      <div className="my-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm">
        <div className="flex items-center gap-2 font-bold mb-1">
          <span>⚠️ SIMULATED PAYMENT</span>
          <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-mono uppercase">
            Mode: {order.paymentMode}
          </span>
        </div>
        <p className="text-stone-700 text-xs leading-relaxed">
          This prototype simulates the payment gateway. No real credit card or bank account was debited. Stock was decremented from the store inventory authority.
        </p>
      </div>

      {/* Order Details */}
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-2 gap-4 text-xs bg-stone-50 p-4 rounded-2xl border border-stone-200">
          <div>
            <span className="text-stone-400 block font-medium">RESERVATION ID</span>
            <span className="font-mono font-semibold text-stone-800">{order.reservationId}</span>
          </div>
          <div>
            <span className="text-stone-400 block font-medium">FULFILLMENT BRANCH</span>
            <span className="font-semibold text-stone-800">{order.storeId}</span>
          </div>
          <div>
            <span className="text-stone-400 block font-medium">CONFIRMED AT</span>
            <span className="font-semibold text-stone-800">
              {new Date(order.createdAt).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-stone-400 block font-medium">ORDER STATUS</span>
            <span className="font-extrabold text-emerald-800">{order.status}</span>
          </div>
        </div>

        {/* Lines */}
        <div className="divide-y divide-stone-100">
          {order.lines.map((line) => (
            <div key={line.productId} className="py-3 flex justify-between items-center text-sm">
              <div>
                <span className="font-bold text-stone-900 block">{line.name}</span>
                <span className="text-xs text-stone-500">
                  {formatPaise(line.unitPricePaise)} × {line.quantity}
                </span>
              </div>
              <span className="font-black text-[#173F35]">
                {formatPaise(line.unitPricePaise * line.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="pt-4 border-t-2 border-stone-200 flex justify-between items-center">
          <span className="text-lg font-bold text-stone-800">Total Paid (Simulated)</span>
          <span className="text-2xl font-black text-[#173F35]">
            {formatPaise(order.totalPaise)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="w-full text-center bg-[#173F35] hover:bg-[#275546] text-white font-bold py-3.5 px-6 rounded-xl transition-colors shadow-xs"
        >
          Return to Store Catalog
        </Link>
      </div>
    </div>
  );
}
