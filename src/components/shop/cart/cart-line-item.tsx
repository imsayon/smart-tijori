'use client';

import React from 'react';
import type { CartLine } from '@/contracts';
import { formatPaise } from '@/lib/utils/currency';

interface CartLineItemProps {
  line: CartLine;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export function CartLineItem({ line, onUpdateQuantity, onRemove }: CartLineItemProps) {
  const lineTotal = line.unitPricePaise * line.quantity;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-stone-200/80 shadow-2xs hover:border-stone-300 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center text-2xl border border-stone-200/50">
          🛍️
        </div>
        <div>
          <h4 className="font-bold text-stone-900 text-sm sm:text-base">{line.name}</h4>
          <p className="text-xs text-stone-500">
            {formatPaise(line.unitPricePaise)} each
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
        {/* Quantity Controls */}
        <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl border border-stone-200">
          <button
            type="button"
            onClick={() => onUpdateQuantity(line.quantity - 1)}
            className="w-7 h-7 rounded-lg bg-white text-stone-800 hover:bg-stone-200 font-bold text-sm flex items-center justify-center transition-colors shadow-2xs"
            aria-label={`Decrease quantity of ${line.name}`}
          >
            −
          </button>
          <span className="text-xs font-bold w-6 text-center">{line.quantity}</span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(line.quantity + 1)}
            className="w-7 h-7 rounded-lg bg-white text-stone-800 hover:bg-stone-200 font-bold text-sm flex items-center justify-center transition-colors shadow-2xs"
            aria-label={`Increase quantity of ${line.name}`}
          >
            +
          </button>
        </div>

        {/* Subtotal */}
        <div className="text-right min-w-[80px]">
          <div className="font-black text-[#173F35] text-base">{formatPaise(lineTotal)}</div>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={onRemove}
          className="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
          aria-label={`Remove ${line.name} from cart`}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
