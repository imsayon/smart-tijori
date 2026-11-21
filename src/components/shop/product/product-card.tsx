'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { ProductOffer } from '@/contracts';
import { formatPaise } from '@/lib/utils/currency';
import { useStore } from '@/lib/session/store-context';
import { StockBadge } from './stock-badge';

interface ProductCardProps {
  offer: ProductOffer;
}

export function ProductCard({ offer }: ProductCardProps) {
  const { cart, addToCart, updateCartQuantity } = useStore();
  const [isAdding, setIsAdding] = useState(false);

  const cartLine = cart?.lines.find((l) => l.productId === offer.productId);
  const currentQty = cartLine?.quantity ?? 0;
  const isOutOfStock = offer.available <= 0;

  const handleAdd = async () => {
    try {
      setIsAdding(true);
      await addToCart(offer, 1);
    } catch (err) {
      console.error('Failed to add product to cart', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleIncrement = async () => {
    if (currentQty >= offer.available) return;
    try {
      setIsAdding(true);
      await updateCartQuantity(offer.productId, currentQty + 1);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDecrement = async () => {
    try {
      setIsAdding(true);
      await updateCartQuantity(offer.productId, currentQty - 1);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E3DDD2] hover:border-[#C89B3C] p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-lg group relative overflow-hidden">
      {/* Subtle top indicator on hover */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0E2A22] via-[#C89B3C] to-[#0E2A22] opacity-0 group-hover:opacity-100 transition-opacity" />

      <div>
        {/* Product Visual Container */}
        <Link
          href={`/products/${offer.productId}`}
          className="block bg-gradient-to-b from-[#F7F4EE] to-[#F1ECE2] rounded-2xl overflow-hidden mb-4 relative aspect-square flex items-center justify-center group-hover:scale-[1.01] transition-transform border border-[#EBE5DA]"
        >
          <div className="text-5xl select-none filter drop-shadow-sm group-hover:scale-110 transition-transform duration-200">
            {offer.category === 'pantry' ? '🌾' : offer.category === 'household' ? '🧼' : '🧴'}
          </div>
          <div className="absolute top-2.5 left-2.5">
            <StockBadge available={offer.available} />
          </div>
        </Link>

        {/* Category & Pack details */}
        <div className="flex items-center justify-between text-xs text-[#78716C] mb-1.5">
          <span className="capitalize font-bold text-[#14382C] tracking-wide">{offer.category}</span>
          <span className="bg-[#F3EFEA] text-[#181614] font-semibold px-2.5 py-0.5 rounded-full font-mono text-[11px] border border-[#E3DDD2]">
            {offer.pack.quantity} {offer.pack.unit}
          </span>
        </div>

        {/* Product Name */}
        <Link href={`/products/${offer.productId}`} className="block">
          <h3 className="font-black text-[#181614] text-base group-hover:text-[#0E2A22] transition-colors line-clamp-2 leading-snug tracking-tight">
            {offer.name}
          </h3>
        </Link>

        {/* Brand / Attributes */}
        {offer.attributes && Object.keys(offer.attributes).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {Object.entries(offer.attributes).slice(0, 2).map(([k, v]) => (
              <span
                key={k}
                className="text-[10px] bg-[#FAF8F5] text-[#57534E] border border-[#E3DDD2] px-2 py-0.5 rounded-md font-medium"
              >
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Pricing & Add to Cart Action */}
      <div className="pt-4 mt-3.5 border-t border-[#F0EBE1] flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-black text-[#0E2A22] tracking-tight">
            {formatPaise(offer.pricePaise)}
          </div>
          <div className="text-[10px] text-[#A8A29E] font-medium tracking-wide">ShelfSync verified</div>
        </div>

        {isOutOfStock ? (
          <Link
            href={`/interest?storeId=${offer.storeId}&productId=${offer.productId}`}
            className="text-xs font-black text-[#B45309] bg-[#FEF3C7] hover:bg-[#FDE68A] px-3.5 py-2 rounded-xl transition-colors border border-[#FCD34D]"
          >
            Notify me
          </Link>
        ) : currentQty === 0 ? (
          <button
            type="button"
            onClick={handleAdd}
            disabled={isAdding}
            className="bg-[#0E2A22] hover:bg-[#163D31] active:scale-95 text-[#FAF8F5] font-black text-xs px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-150 disabled:opacity-50 cursor-pointer border border-[#276350]/60 focus:ring-2 focus:ring-[#F59E0B]"
          >
            {isAdding ? 'Adding…' : '+ Add to cart'}
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-[#F3EFEA] p-1 rounded-xl border border-[#E3DDD2]">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={isAdding}
              className="w-7 h-7 rounded-lg bg-white text-[#181614] hover:bg-[#E5DFD5] font-black text-sm flex items-center justify-center transition-colors shadow-2xs border border-[#E3DDD2] cursor-pointer"
              aria-label={`Decrease quantity of ${offer.name}`}
            >
              −
            </button>
            <span className="text-xs font-black w-5 text-center text-[#0E2A22]">{currentQty}</span>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={isAdding || currentQty >= offer.available}
              className="w-7 h-7 rounded-lg bg-white text-[#181614] hover:bg-[#E5DFD5] font-black text-sm flex items-center justify-center transition-colors shadow-2xs border border-[#E3DDD2] disabled:opacity-40 cursor-pointer"
              aria-label={`Increase quantity of ${offer.name}`}
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
