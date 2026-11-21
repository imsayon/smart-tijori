'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { ProductOffer } from '@/contracts';
import { formatPaise } from '@/lib/utils/currency';
import { useStore } from '@/lib/session/store-context';
import { ProductImage } from './product-image';
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
    <div className="bg-[#faf7f0] border border-[#dcd6c9] p-2.5 sm:p-4 flex flex-col justify-between group">
      <div>
        {/* Image / Placeholder */}
        <Link
          href={`/products/${offer.productId}`}
          aria-label={`View ${offer.name}`}
          className="bg-[#eae8dc] rounded-sm overflow-hidden mb-3.5 relative aspect-square flex items-center justify-center group-hover:opacity-95 transition-opacity"
        >
          <ProductImage key={offer.imageUrl} offer={offer} />
          <div className="absolute top-2 left-2">
            <StockBadge available={offer.available} />
          </div>
        </Link>

        {/* Category & purpose */}
        <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
          <span className="capitalize font-medium text-stone-600">{offer.category}</span>
          <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-mono text-[10px]">
            {offer.pack.quantity} {offer.pack.unit}
          </span>
        </div>

        {/* Name */}
        <Link href={`/products/${offer.productId}`} className="block">
          <h3 className="font-bold text-stone-900 text-base group-hover:text-[#173F35] transition-colors line-clamp-2 leading-snug">
            {offer.name}
          </h3>
        </Link>

        {/* Attributes / Key features */}
        {offer.attributes && Object.keys(offer.attributes).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(offer.attributes).slice(0, 2).map(([k, v]) => (
              <span
                key={k}
                className="text-[11px] bg-stone-50 text-stone-600 border border-stone-200 px-1.5 py-0.5 rounded-md"
              >
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Pricing & Add to Cart */}
      <div className="pt-4 mt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-lg font-extrabold text-[#173F35]">
            {formatPaise(offer.pricePaise)}
          </div>

        </div>

        {isOutOfStock ? (
          <Link
            href={`/interest?storeId=${offer.storeId}&productId=${offer.productId}`}
            className="text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-2 rounded-xl transition-colors"
          >
            Save restock interest
          </Link>
        ) : currentQty === 0 ? (
          <button
            type="button"
            onClick={handleAdd}
            disabled={!cart || isAdding}
            className="bg-[#173F35] hover:bg-[#275546] active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all disabled:opacity-50 focus:ring-2 focus:ring-lime-400"
          >
            {isAdding ? 'Adding…' : '+ Add to cart'}
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={isAdding}
              className="w-7 h-7 rounded-lg bg-white text-stone-800 hover:bg-stone-200 font-bold text-sm flex items-center justify-center transition-colors shadow-2xs"
              aria-label={`Decrease quantity of ${offer.name}`}
            >
              −
            </button>
            <span className="text-xs font-bold w-5 text-center">{currentQty}</span>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={isAdding || currentQty >= offer.available}
              className="w-7 h-7 rounded-lg bg-white text-stone-800 hover:bg-stone-200 font-bold text-sm flex items-center justify-center transition-colors shadow-2xs disabled:opacity-40"
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
