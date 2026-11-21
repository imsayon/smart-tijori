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
    <div className="bg-white rounded-3xl border border-stone-200 p-6 md:p-8 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Visual Showcase */}
        <div className="bg-stone-100 rounded-2xl aspect-square flex items-center justify-center text-7xl select-none relative overflow-hidden border border-stone-200/80">
          <span>{offer.category === 'pantry' ? '🌾' : offer.category === 'household' ? '🧼' : '🧴'}</span>
          <div className="absolute top-4 left-4">
            <StockBadge available={offer.available} />
          </div>
        </div>

        {/* Details & Actions */}
        <div className="flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center gap-2 text-xs text-stone-500 uppercase tracking-wider mb-2">
              <span className="font-semibold text-emerald-800">{offer.city} Branch</span>
              <span>•</span>
              <span className="capitalize">{offer.category}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mb-3 leading-tight">
              {offer.name}
            </h1>

            <div className="flex items-baseline gap-4 mb-6">
              <span className="text-3xl font-black text-[#173F35]">
                {formatPaise(offer.pricePaise)}
              </span>
              <span className="text-sm text-stone-500">
                Pack: {offer.pack.quantity} {offer.pack.unit}
              </span>
            </div>

            {/* ShelfSync stock guarantee badge */}
            <div className="bg-[#F5F1E8] border border-[#275546]/20 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-[#173F35] mb-1">
                <span>🛡️ ShelfSync Verified</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Counter POS and online storefront allocate from identical book stock. Adding to cart does not lock stock; stock is committed during checkout CartLock hold.
              </p>
            </div>

            {/* Known Specifications */}
            <div className="mb-6">
              <h3 className="font-bold text-sm text-stone-800 mb-2">Known Attributes</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                  <span className="text-stone-400 block text-[10px]">PURPOSE</span>
                  <span className="font-semibold text-stone-700 capitalize">{offer.purpose}</span>
                </div>
                <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                  <span className="text-stone-400 block text-[10px]">PACKAGE</span>
                  <span className="font-semibold text-stone-700">
                    {offer.pack.quantity} {offer.pack.unit}
                  </span>
                </div>
                {Object.entries(offer.attributes).map(([k, v]) => (
                  <div key={k} className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                    <span className="text-stone-400 block text-[10px] uppercase">{k}</span>
                    <span className="font-semibold text-stone-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-6 border-t border-stone-100 flex items-center gap-4">
            {isOutOfStock ? (
              <div className="flex-1">
                <Link
                  href={`/interest?storeId=${offer.storeId}&productId=${offer.productId}`}
                  className="w-full text-center block bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 px-6 rounded-xl transition-colors shadow-xs"
                >
                  Save stock interest (Notify me)
                </Link>
              </div>
            ) : currentQty === 0 ? (
              <button
                type="button"
                onClick={handleAdd}
                disabled={!cart || isAdding}
                className="flex-1 bg-[#173F35] hover:bg-[#275546] text-white font-bold py-3.5 px-6 rounded-xl transition-all active:scale-98 shadow-sm focus:ring-2 focus:ring-lime-400 disabled:opacity-50"
              >
                {isAdding ? 'Adding…' : 'Add to Cart'}
              </button>
            ) : (
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-3 bg-stone-100 p-2 rounded-xl border border-stone-200">
                  <button
                    type="button"
                    onClick={() => updateCartQuantity(offer.productId, currentQty - 1)}
                    className="w-9 h-9 rounded-lg bg-white text-stone-800 font-bold hover:bg-stone-200 transition-colors shadow-2xs"
                  >
                    −
                  </button>
                  <span className="font-bold text-base w-8 text-center">{currentQty}</span>
                  <button
                    type="button"
                    onClick={() => updateCartQuantity(offer.productId, currentQty + 1)}
                    disabled={currentQty >= offer.available}
                    className="w-9 h-9 rounded-lg bg-white text-stone-800 font-bold hover:bg-stone-200 transition-colors shadow-2xs disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <Link
                  href="/cart"
                  className="flex-1 text-center bg-lime-400 hover:bg-lime-300 text-[#173F35] font-extrabold py-3.5 px-6 rounded-xl transition-colors shadow-xs"
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
