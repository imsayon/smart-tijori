import React from 'react';

interface StockBadgeProps {
  available: number;
}

export function StockBadge({ available }: StockBadgeProps) {
  if (available <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-900 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-full shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
        Out of stock
      </span>
    );
  }

  if (available <= 3) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-950 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-full shadow-2xs animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
        LastOne: Only {available} left!
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#14382C] bg-[#EAF4EE] border border-[#B8DEC8] px-2.5 py-1 rounded-full shadow-2xs">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
      {available} in stock
    </span>
  );
}
