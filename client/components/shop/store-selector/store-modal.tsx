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
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
          <div>
            <h3 id="store-modal-title" className="text-xl font-black text-stone-900">
              Select Neighborhood Store
            </h3>
            <p className="text-xs text-stone-500">
              Pick your local area branch for accurate in-store stock authority.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-xl font-bold p-1 rounded-md"
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
            placeholder="Search by area (e.g. Koramangala, Indiranagar, Whitefield, Gokulam)…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#173F35]"
          />

          <div className="flex items-center gap-2">
            {(['ALL', 'Bengaluru', 'Mysuru'] as const).map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setFilterCity(city)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  filterCity === city
                    ? 'bg-[#173F35] text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
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
            <div className="p-8 text-center text-xs text-stone-500">
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

        <div className="bg-[#F5F1E8] p-3 rounded-2xl border border-[#275546]/20 text-xs text-stone-700 flex items-center gap-2">
          <span>🏪</span>
          <span>
            Orders are fulfilled exclusively from the selected neighborhood branch. Changing store resets your cart.
          </span>
        </div>
      </div>
    </div>
  );
}
