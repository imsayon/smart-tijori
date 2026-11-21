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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4.5 rounded-2xl bg-white border border-[#E3DDD2] shadow-xs hover:border-[#C89B3C] transition-all duration-150">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-[#F7F5F0] flex items-center justify-center text-2xl border border-[#E3DDD2]">
          🛍️
        </div>
        <div>
          <h4 className="font-black text-[#181614] text-sm sm:text-base tracking-tight">{line.name}</h4>
          <p className="text-xs text-[#78716C] font-mono mt-0.5">
            {formatPaise(line.unitPricePaise)} each
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
        {/* Quantity Controls */}
        <div className="flex items-center gap-2 bg-[#F3EFEA] p-1 rounded-xl border border-[#E3DDD2]">
          <button
            type="button"
            onClick={() => onUpdateQuantity(line.quantity - 1)}
            className="w-7 h-7 rounded-lg bg-white text-[#181614] hover:bg-[#E5DFD5] font-black text-sm flex items-center justify-center transition-colors shadow-2xs border border-[#E3DDD2] cursor-pointer"
            aria-label={`Decrease quantity of ${line.name}`}
          >
            −
          </button>
          <span className="text-xs font-black w-6 text-center text-[#0E2A22]">{line.quantity}</span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(line.quantity + 1)}
            className="w-7 h-7 rounded-lg bg-white text-[#181614] hover:bg-[#E5DFD5] font-black text-sm flex items-center justify-center transition-colors shadow-2xs border border-[#E3DDD2] cursor-pointer"
            aria-label={`Increase quantity of ${line.name}`}
          >
            +
          </button>
        </div>

        {/* Subtotal */}
        <div className="text-right min-w-[90px]">
          <div className="font-black text-[#0E2A22] text-base font-mono">{formatPaise(lineTotal)}</div>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={onRemove}
          className="text-[#A8A29E] hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
          aria-label={`Remove ${line.name} from cart`}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
