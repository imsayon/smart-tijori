import React from 'react';

interface StockBadgeProps {
  available: number;
}

export function StockBadge({ available }: StockBadgeProps) {
  if (available <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
        Out of stock
      </span>
    );
  }

  if (available <= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
        LastOne: Only {available} left!
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
      {available} in stock
    </span>
  );
}
