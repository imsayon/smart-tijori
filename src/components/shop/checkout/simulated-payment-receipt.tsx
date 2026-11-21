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
    <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-[#E3DDD2] p-6 sm:p-10 shadow-xl text-[#181614] animate-in fade-in zoom-in-95 relative overflow-hidden">
      {/* Decorative top brass border */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#0E2A22] via-[#C89B3C] to-[#0E2A22]" />

      {/* Success banner */}
      <div className="text-center pb-8 border-b border-[#F0EBE1]">
        <div className="w-16 h-16 bg-[#EAF4EE] text-[#0E2A22] rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-[#B8DEC8] shadow-xs">
          ✓
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#0E2A22] mb-2 tracking-tight">
          Order Confirmed!
        </h1>
        <p className="text-xs sm:text-sm text-[#57534E]">
          Your reservation was atomically consumed and converted to order{' '}
          <span className="font-mono font-bold text-[#0E2A22] bg-[#F3EFEA] px-2 py-0.5 rounded-md border border-[#E3DDD2]">
            {order.id}
          </span>.
        </p>
      </div>

      {/* Simulated Payment Notice (Mandatory per Master Plan) */}
      <div className="my-6 p-4.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs sm:text-sm shadow-2xs">
        <div className="flex items-center gap-2 font-black mb-1">
          <span>⚠️ SIMULATED PAYMENT</span>
          <span className="text-[10px] bg-amber-200 text-amber-950 px-2 py-0.5 rounded-full font-mono uppercase font-bold">
            Mode: {order.paymentMode}
          </span>
        </div>
        <p className="text-stone-700 text-xs leading-relaxed">
          This prototype simulates the payment gateway. No real credit card or bank account was debited. Stock was decremented from the store inventory authority.
        </p>
      </div>

      {/* Order Details Metadata Grid */}
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-2 gap-4 text-xs bg-[#F7F5F0] p-4.5 rounded-2xl border border-[#E3DDD2]">
          <div>
            <span className="text-[#78716C] block font-bold text-[10px] uppercase tracking-wider mb-0.5">RESERVATION ID</span>
            <span className="font-mono font-bold text-[#181614]">{order.reservationId}</span>
          </div>
          <div>
            <span className="text-[#78716C] block font-bold text-[10px] uppercase tracking-wider mb-0.5">FULFILLMENT BRANCH</span>
            <span className="font-bold text-[#181614]">{order.storeId}</span>
          </div>
          <div>
            <span className="text-[#78716C] block font-bold text-[10px] uppercase tracking-wider mb-0.5">CONFIRMED AT</span>
            <span className="font-semibold text-[#181614]">
              {new Date(order.createdAt).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[#78716C] block font-bold text-[10px] uppercase tracking-wider mb-0.5">ORDER STATUS</span>
            <span className="inline-block text-[11px] bg-[#EAF4EE] text-[#14382C] font-black px-2.5 py-0.5 rounded-full border border-[#B8DEC8]">
              {order.status}
            </span>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-[#E3DDD2] rounded-2xl overflow-hidden shadow-2xs">
          <div className="bg-[#F3EFEA] px-4 py-2.5 text-xs font-black text-[#57534E] uppercase tracking-wider border-b border-[#E3DDD2]">
            Purchased Items
          </div>
          <div className="divide-y divide-[#F0EBE1] bg-white">
            {order.lines.map((line) => (
              <div key={line.productId} className="px-4 py-3 flex justify-between items-center text-xs sm:text-sm">
                <div>
                  <div className="font-bold text-[#181614]">{line.name}</div>
                  <div className="text-[11px] text-[#78716C]">
                    Qty: {line.quantity} × {formatPaise(line.unitPricePaise)}
                  </div>
                </div>
                <div className="font-black text-[#0E2A22] font-mono">
                  {formatPaise(line.unitPricePaise * line.quantity)}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-[#F7F5F0] px-4 py-3.5 flex justify-between items-center border-t border-[#E3DDD2]">
            <span className="font-black text-sm text-[#181614]">Total Paid (Simulated)</span>
            <span className="text-xl font-black text-[#0E2A22] font-mono">
              {formatPaise(order.totalPaise)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <Link
          href="/"
          className="bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] font-black text-sm py-3.5 px-8 rounded-full text-center transition-all duration-150 shadow-md hover:shadow-lg active:scale-95 border border-[#276350]/60"
        >
          Return to Shop →
        </Link>
        <Link
          href={`/orders/${order.id}`}
          className="bg-[#F3EFEA] hover:bg-[#E5DFD5] text-[#181614] font-bold text-sm py-3.5 px-6 rounded-full text-center transition-colors border border-[#E3DDD2]"
        >
          View Full Receipt
        </Link>
      </div>
    </div>
  );
}
