'use client';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/session/store-context';

export function Header({ onOpenStoreSelector }: { onOpenStoreSelector?: () => void }) {
  const { selectedStore, cartItemCount, openStoreModal } = useStore();
  const handleOpen = onOpenStoreSelector ?? openStoreModal;

  return (
    <header className="sticky top-0 z-40 bg-[#173F35] text-white shadow-md border-b border-[#275546]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
              <span className="text-lime-400">Smart</span>Tijori
            </span>
          </Link>

          {/* Branch selector trigger */}
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-2 text-xs sm:text-sm bg-[#275546] hover:bg-[#326956] text-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-600/40 transition-colors focus:outline-hidden focus:ring-2 focus:ring-lime-400"
            aria-label="Current store. Click to change store."
          >
            <span className="w-2 h-2 rounded-full bg-lime-400" />
            <span className="font-semibold text-white">
              {selectedStore ? selectedStore.name : 'Select Store'}
            </span>
            {selectedStore?.area && (
              <span className="hidden sm:inline text-[10px] bg-emerald-900/60 text-emerald-200 px-1.5 py-0.5 rounded-md">
                {selectedStore.area}
              </span>
            )}
            <span className="text-emerald-300 text-xs">▼</span>
          </button>
        </div>

        {/* Navigation links */}
        <div className="flex items-center gap-4">
          <Link
            href="/search"
            className="text-sm text-emerald-100 hover:text-white px-3 py-1.5 rounded-md hover:bg-emerald-800/40 transition-colors"
          >
            Search
          </Link>

          {/* Cart Icon */}
          <Link
            href="/cart"
            className="relative flex items-center gap-2 bg-lime-400 hover:bg-lime-300 text-[#173F35] font-bold text-sm px-4 py-2 rounded-xl transition-transform active:scale-95 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-white"
            aria-label={`Cart with ${cartItemCount} items`}
          >
            <span>Cart</span>
            {cartItemCount > 0 && (
              <span className="bg-[#173F35] text-white text-xs px-2 py-0.5 rounded-full font-extrabold min-w-[20px] text-center">
                {cartItemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
