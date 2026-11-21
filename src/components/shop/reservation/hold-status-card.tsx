import React from 'react';
import type { Hold } from '@/contracts';
import { formatPaise } from '@/lib/utils/currency';
import { HoldTimer } from '../checkout/hold-timer';

interface HoldStatusCardProps {
  hold: Hold;
  onExpire?: () => void;
}

export function HoldStatusCard({ hold, onExpire }: HoldStatusCardProps) {
  return (
    <div className="bg-white rounded-3xl border border-[#E3DDD2] p-6 sm:p-7 shadow-md mb-6 relative overflow-hidden">
      {/* Top brass accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0E2A22] via-[#C89B3C] to-[#0E2A22]" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-[#F0EBE1] gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-black text-[#181614] text-xl tracking-tight flex items-center gap-2">
              <span className="text-[#C89B3C]">🔒</span>
              <span>CartLock Reservation</span>
            </span>
            <span className="text-xs bg-[#EAF4EE] text-[#14382C] font-mono font-bold px-2.5 py-0.5 rounded-full border border-[#B8DEC8]">
              {hold.id}
            </span>
          </div>
          <p className="text-xs text-[#78716C] mt-1 flex items-center gap-2">
            <span>Store: <strong className="text-[#181614]">{hold.storeId}</strong></span>
            <span>·</span>
            <span className="text-[#0E2A22] font-semibold">Status: {hold.status}</span>
          </p>
        </div>

        {hold.status === 'ACTIVE' && (
          <HoldTimer
            expiresAt={hold.expiresAt}
            serverNow={hold.serverNow}
            onExpire={onExpire}
          />
        )}
      </div>

      <div className="py-5 space-y-2.5">
        <div className="text-[11px] font-black text-[#78716C] uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Locked Quantities (Atomic Hold)</span>
          <span className="text-[10px] text-[#A8A29E] normal-case">ShelfSync Guaranteed</span>
        </div>
        {hold.lines.map((l) => (
          <div key={l.productId} className="flex justify-between items-center text-sm py-2 border-b border-[#FAF8F5]">
            <span className="text-[#181614] font-medium">
              {l.name} <span className="text-[#78716C] font-normal font-mono">× {l.quantity}</span>
            </span>
            <span className="font-black text-[#0E2A22] font-mono">
              {formatPaise(l.unitPricePaise * l.quantity)}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-4 flex justify-between items-center border-t border-[#F0EBE1]">
        <div>
          <span className="font-bold text-[#57534E] text-sm">Hold Total</span>
          <p className="text-[10px] text-[#A8A29E]">Taxes & packing included</p>
        </div>
        <span className="text-2xl font-black text-[#0E2A22] tracking-tight">
          {formatPaise(hold.totalPaise)}
        </span>
      </div>
    </div>
  );
}
