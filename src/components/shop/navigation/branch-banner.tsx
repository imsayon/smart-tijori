'use client';

import React from 'react';
import { useStore } from '@/lib/session/store-context';

export function BranchBanner({ onOpenStoreSelector }: { onOpenStoreSelector?: () => void }) {
  const { selectedStore, openStoreModal } = useStore();
  const handleOpen = onOpenStoreSelector ?? openStoreModal;

  if (!selectedStore) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-[#F7F4EE] via-[#FBF9F5] to-[#F5F1E8] border border-[#E3DDD2] rounded-3xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:border-[#C89B3C]/50 transition-all">
      {/* Decorative subtle background aura */}
      <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-[#C89B3C]/5 to-transparent pointer-events-none" />

      <div className="flex items-center gap-3.5 relative z-10">
        <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#0E2A22] to-[#163D31] text-white flex items-center justify-center font-bold text-2xl shadow-md border border-[#1D4A3C]">
          🏪
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-black text-[#181614] text-base sm:text-lg tracking-tight">
              {selectedStore.name}
            </h2>
            {selectedStore.area && (
              <span className="text-xs bg-[#EAF4EE] text-[#14382C] font-black px-2.5 py-0.5 rounded-full border border-[#B8DEC8]">
                {selectedStore.area}
              </span>
            )}
            <span className="text-[11px] bg-[#0E2A22] text-[#F59E0B] font-bold px-2.5 py-0.5 rounded-full border border-[#1D4A3C]">
              {selectedStore.city}
            </span>
          </div>
          {selectedStore.address && (
            <p className="text-xs text-[#57534E] mt-1 flex items-center gap-1.5">
              <span>📍 {selectedStore.address}</span>
              <span className="text-[#C89B3C] font-semibold">· ShelfSync Live Counter</span>
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        className="self-stretch sm:self-auto bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] text-xs sm:text-sm font-black px-5 py-2.5 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-[#276350]/60 relative z-10"
      >
        <span>📍 Change Store / Area</span>
        <span className="text-[#F59E0B] font-bold">→</span>
      </button>
    </div>
  );
}
