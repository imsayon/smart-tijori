'use client';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/session/store-context';

export function Header({ onOpenStoreSelector }: { onOpenStoreSelector?: () => void }) {
  const { selectedStore, cartItemCount, openStoreModal } = useStore();
  const handleOpen = onOpenStoreSelector ?? openStoreModal;

  return (
    <header className="sticky top-0 z-40 bg-[#0E2A22] text-[#FAF8F5] shadow-lg border-b border-[#1D4A3C]/80 backdrop-blur-md bg-opacity-95 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-17 flex items-center justify-between gap-4">
        {/* Brand & Identity */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* Vault Tijori Icon */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C89B3C] via-[#E5B558] to-[#997324] p-[1.5px] shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0E2A22] rounded-[10px] flex items-center justify-center text-[#E5B558] font-black text-sm">
                ST
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-1">
                <span className="text-[#F59E0B] drop-shadow-xs">Smart</span>
                <span className="text-[#FAF8F5]">Tijori</span>
              </span>
              <span className="hidden md:inline-block text-[10px] uppercase tracking-widest text-[#A8C7BC] font-medium -mt-0.5">
                Neighborhood Vault · Single Stock Truth
              </span>
            </div>
          </Link>

          {/* Branch selector trigger */}
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-2.5 text-xs sm:text-sm bg-[#163D31] hover:bg-[#1D4A3C] text-[#E8F3EE] px-3.5 py-1.5 rounded-full border border-[#276350]/60 transition-all shadow-xs hover:border-[#C89B3C]/50 focus:outline-hidden focus:ring-2 focus:ring-[#F59E0B]"
            aria-label="Current store. Click to change store."
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="font-semibold text-white tracking-wide">
              {selectedStore ? selectedStore.name : 'Select Store'}
            </span>
            {selectedStore?.area && (
              <span className="hidden sm:inline-block text-[10px] bg-[#0E2A22] text-[#A8C7BC] font-medium px-2 py-0.5 rounded-full border border-[#1D4A3C]">
                {selectedStore.area}
              </span>
            )}
            <span className="text-[#C89B3C] text-[10px] font-bold">▼</span>
          </button>
        </div>

        {/* Navigation & Cart */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/search"
            className="flex items-center gap-1.5 text-xs sm:text-sm text-[#A8C7BC] hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#163D31]/70 transition-colors border border-transparent hover:border-[#276350]/50"
          >
            <span>🔍</span>
            <span className="font-medium">Search</span>
          </Link>

          {/* Cart Trigger with Pill badge */}
          <Link
            href="/cart"
            className="relative flex items-center gap-2.5 bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#FBBF24] hover:to-[#D97706] text-[#0E2A22] font-black text-xs sm:text-sm px-4 py-2 rounded-full transition-all duration-150 active:scale-95 shadow-md hover:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-[#FAF8F5]"
            aria-label={`Cart with ${cartItemCount} items`}
          >
            <span className="text-base leading-none">🛒</span>
            <span className="tracking-wide">Cart</span>
            {cartItemCount > 0 && (
              <span className="bg-[#0E2A22] text-[#F59E0B] text-xs px-2 py-0.5 rounded-full font-black min-w-[22px] text-center shadow-xs">
                {cartItemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
