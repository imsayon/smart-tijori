'use client';

import React from 'react';
import { useStore } from '@/lib/session/store-context';

export function BranchBanner({ onOpenStoreSelector }: { onOpenStoreSelector?: () => void }) {
  const { selectedStore, openStoreModal } = useStore();
  const handleOpen = onOpenStoreSelector ?? openStoreModal;

  if (!selectedStore) return null;

  return (
    <div className="bg-[#F5F1E8] border border-[#275546]/20 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#173F35] text-white flex items-center justify-center font-bold text-2xl shadow-xs">
          🏪
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-extrabold text-stone-900 text-base sm:text-lg">
              {selectedStore.name}
            </h2>
            {selectedStore.area && (
              <span className="text-xs bg-emerald-100 text-emerald-900 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                {selectedStore.area}
              </span>
            )}
            <span className="text-xs bg-[#173F35] text-white font-semibold px-2 py-0.5 rounded-full">
              {selectedStore.city}
            </span>
          </div>
          {selectedStore.address && (
            <p className="text-xs text-stone-600 mt-1">📍 {selectedStore.address}</p>
          )}
          {selectedStore.id.startsWith('dm-') && (
            <p className="text-xs text-[#83623c] mt-1">
              Illustrative retail profile · Stock is not confirmed with this merchant.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        className="self-stretch sm:self-auto bg-[#173F35] hover:bg-[#275546] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>📍 Change Store / Area</span>
        <span>→</span>
      </button>
    </div>
  );
}
