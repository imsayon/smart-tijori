'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/session/store-context';
import { BranchCard } from './branch-card';

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StoreModal({ isOpen, onClose }: StoreModalProps) {
  const { availableStores, selectedStoreId, selectStore } = useStore();
  const [filterCity, setFilterCity] = useState<'ALL' | 'Bengaluru' | 'Mysuru'>('ALL');
  const [searchArea, setSearchArea] = useState('');

  if (!isOpen) return null;

  const filteredStores = availableStores.filter((store) => {
    if (filterCity !== 'ALL' && store.city !== filterCity) return false;
    if (searchArea.trim() !== '') {
      const q = searchArea.toLowerCase();
      return (
        store.name.toLowerCase().includes(q) ||
        (store.area?.toLowerCase().includes(q) ?? false) ||
        (store.address?.toLowerCase().includes(q) ?? false) ||
        store.city.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-[#E3DDD2] max-h-[90vh] flex flex-col relative overflow-hidden">
        {/* Top subtle brass trim */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0E2A22] via-[#C89B3C] to-[#0E2A22]" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#F0EBE1] mb-4">
          <div>
            <h3 id="store-modal-title" className="text-xl font-black text-[#181614] tracking-tight">
              Select Neighborhood Store
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              Pick your local branch for ShelfSync real-time counter inventory authority.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#A8A29E] hover:text-[#181614] text-xl font-black p-1.5 rounded-lg hover:bg-[#F3EFEA] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Filter controls */}
        <div className="space-y-3 mb-4">
          <input
            type="search"
            value={searchArea}
            onChange={(e) => setSearchArea(e.target.value)}
            placeholder="Search by area (e.g. Koramangala, Indiranagar, Malleshwaram, Gokulam)…"
            className="w-full px-4 py-2.5 rounded-xl border border-[#E3DDD2] text-xs text-[#181614] placeholder:text-[#A8A29E] focus:ring-2 focus:ring-[#0E2A22] focus:border-[#0E2A22] bg-[#FAF8F5]"
          />

          <div className="flex items-center gap-2">
            {(['ALL', 'Bengaluru', 'Mysuru'] as const).map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setFilterCity(city)}
                className={`text-xs font-black px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  filterCity === city
                    ? 'bg-[#0E2A22] text-[#F59E0B] shadow-xs'
                    : 'bg-[#F3EFEA] text-[#57534E] hover:bg-[#E5DFD5]'
                }`}
              >
                {city === 'ALL' ? 'All Areas' : `${city} Area`}
              </button>
            ))}
          </div>
        </div>

        {/* Store list */}
        <div className="space-y-3 overflow-y-auto flex-1 pr-1 mb-4">
          {filteredStores.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#78716C]">
              No store branches found matching &quot;{searchArea}&quot;.
            </div>
          ) : (
            filteredStores.map((store) => (
              <BranchCard
                key={store.id}
                store={store}
                isSelected={store.id === selectedStoreId}
                onSelect={() => {
                  selectStore(store);
                  onClose();
                }}
              />
            ))
          )}
        </div>

        <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E3DDD2] text-xs text-[#57534E] flex items-center gap-2.5">
          <span className="text-base">🏪</span>
          <span className="leading-relaxed">
            Orders are fulfilled exclusively from the selected neighborhood branch. Changing store resets your cart.
          </span>
        </div>
      </div>
    </div>
  );
}
