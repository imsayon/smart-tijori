'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { ProductOffer } from '@/contracts';
import { formatPaise } from '@/lib/utils/currency';
import { useStore } from '@/lib/session/store-context';
import { StockBadge } from './stock-badge';

export function ProductDetail({ offer }: { offer: ProductOffer }) {
  const { cart, addToCart, updateCartQuantity } = useStore();
  const [isAdding, setIsAdding] = useState(false);

  const cartLine = cart?.lines.find((l) => l.productId === offer.productId);
  const currentQty = cartLine?.quantity ?? 0;
  const isOutOfStock = offer.available <= 0;

  const handleAdd = async () => {
    try {
      setIsAdding(true);
      await addToCart(offer, 1);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E3DDD2] p-6 sm:p-10 shadow-lg relative overflow-hidden">
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0E2A22] via-[#C89B3C] to-[#0E2A22]" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Visual Showcase */}
        <div className="bg-gradient-to-b from-[#F7F4EE] to-[#F1ECE2] rounded-3xl aspect-square flex items-center justify-center text-8xl select-none relative overflow-hidden border border-[#E3DDD2] shadow-inner">
          <span className="filter drop-shadow-md hover:scale-110 transition-transform duration-300">
            {offer.category === 'pantry' ? '🌾' : offer.category === 'household' ? '🧼' : '🧴'}
          </span>
          <div className="absolute top-4 left-4">
            <StockBadge available={offer.available} />
          </div>
        </div>

        {/* Details & Actions */}
        <div className="flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#78716C] uppercase tracking-wider mb-2.5 font-bold">
              <span className="text-[#0E2A22] bg-[#EAF4EE] px-2.5 py-0.5 rounded-full border border-[#B8DEC8]">
                {offer.city} Branch
              </span>
              <span>•</span>
              <span className="capitalize">{offer.category}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-[#181614] mb-3 leading-tight tracking-tight">
              {offer.name}
            </h1>

            <div className="flex items-baseline gap-4 mb-6">
              <span className="text-3xl sm:text-4xl font-black text-[#0E2A22] tracking-tight">
                {formatPaise(offer.pricePaise)}
              </span>
              <span className="text-sm text-[#78716C] font-mono bg-[#F3EFEA] px-3 py-1 rounded-full border border-[#E3DDD2]">
                Pack: {offer.pack.quantity} {offer.pack.unit}
              </span>
            </div>

            {/* ShelfSync stock guarantee badge */}
            <div className="bg-gradient-to-r from-[#F7F4EE] to-[#F4EFE6] border border-[#C89B3C]/40 rounded-2xl p-4.5 mb-6 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-black text-[#0E2A22] mb-1">
                <span className="text-base">🛡️</span>
                <span>ShelfSync Verified Counter Stock</span>
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">
                Physical counter POS and online storefront allocate from identical transactional book stock. Adding to cart does not lock stock; stock is committed during checkout CartLock hold.
              </p>
            </div>

            {/* Known Specifications */}
            <div className="mb-6">
              <h3 className="font-black text-sm text-[#181614] mb-3 uppercase tracking-wider text-[11px]">
                Product Specifications
              </h3>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E3DDD2]">
                  <span className="text-[#A8A29E] block text-[10px] font-bold uppercase tracking-wider mb-0.5">PURPOSE</span>
                  <span className="font-bold text-[#181614] capitalize">{offer.purpose}</span>
                </div>
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E3DDD2]">
                  <span className="text-[#A8A29E] block text-[10px] font-bold uppercase tracking-wider mb-0.5">PACKAGE</span>
                  <span className="font-bold text-[#181614]">
                    {offer.pack.quantity} {offer.pack.unit}
                  </span>
                </div>
                {Object.entries(offer.attributes).map(([k, v]) => (
                  <div key={k} className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E3DDD2]">
                    <span className="text-[#A8A29E] block text-[10px] font-bold uppercase tracking-wider mb-0.5">{k}</span>
                    <span className="font-bold text-[#181614]">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-6 border-t border-[#F0EBE1] flex items-center gap-4">
            {isOutOfStock ? (
              <div className="flex-1">
                <Link
                  href={`/interest?storeId=${offer.storeId}&productId=${offer.productId}`}
                  className="w-full text-center block bg-amber-600 hover:bg-amber-700 text-white font-black py-4 px-6 rounded-full transition-colors shadow-md"
                >
                  Save stock interest (Notify me)
                </Link>
              </div>
            ) : currentQty === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                disabled={isAdding}
                className="flex-1 bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] font-black text-base py-4 px-8 rounded-full transition-all duration-150 active:scale-98 shadow-md hover:shadow-lg border border-[#276350]/60 cursor-pointer disabled:opacity-50"
              >
                {isAdding ? 'Adding…' : 'Add to Cart'}
              </button>
            ) : (
              <div className="flex items-center gap-4 flex-1 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-3 bg-[#F3EFEA] p-2 rounded-2xl border border-[#E3DDD2]">
                  <button
                    type="button"
                    onClick={() => updateCartQuantity(offer.productId, currentQty - 1)}
                    className="w-10 h-10 rounded-xl bg-white text-[#181614] font-black hover:bg-[#E5DFD5] transition-colors shadow-2xs border border-[#E3DDD2] cursor-pointer"
                    aria-label={`Decrease quantity of ${offer.name}`}
                  >
                    −
                  </button>
                  <span className="font-black text-lg w-8 text-center text-[#0E2A22]">{currentQty}</span>
                  <button
                    type="button"
                    onClick={() => updateCartQuantity(offer.productId, currentQty + 1)}
                    disabled={currentQty >= offer.available}
                    className="w-10 h-10 rounded-xl bg-white text-[#181614] font-black hover:bg-[#E5DFD5] transition-colors shadow-2xs border border-[#E3DDD2] disabled:opacity-40 cursor-pointer"
                    aria-label={`Increase quantity of ${offer.name}`}
                  >
                    +
                  </button>
                </div>
                <Link
                  href="/cart"
                  className="flex-1 text-center bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#FBBF24] hover:to-[#D97706] text-[#0E2A22] font-black py-4 px-6 rounded-full transition-all shadow-md hover:shadow-lg active:scale-98"
                >
                  View in Cart →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
