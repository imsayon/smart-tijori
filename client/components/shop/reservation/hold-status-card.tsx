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
    <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-stone-900 text-lg">CartLock Reservation</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-mono px-2 py-0.5 rounded-md">
              {hold.id}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Store: <span className="font-semibold">{hold.storeId}</span> · Status: {hold.status}
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

      <div className="py-4 space-y-2">
        <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
          Locked Quantities (Atomic Hold)
        </div>
        {hold.lines.map((l) => (
          <div key={l.productId} className="flex justify-between text-sm py-1 border-b border-stone-50">
            <span className="text-stone-800">
              {l.name} <span className="text-stone-400">× {l.quantity}</span>
            </span>
            <span className="font-semibold text-stone-900">
              {formatPaise(l.unitPricePaise * l.quantity)}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-3 flex justify-between items-center text-sm">
        <span className="font-bold text-stone-700">Hold Total</span>
        <span className="text-xl font-black text-[#173F35]">
          {formatPaise(hold.totalPaise)}
        </span>
      </div>
    </div>
  );
}
