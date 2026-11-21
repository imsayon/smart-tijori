'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/session/store-context';
import { BranchCard } from '@/components/shop/store-selector/branch-card';
import { Alert } from '@/components/shop/feedback/alert';

export default function StoresPage() {
  const { availableStores, selectedStoreId, selectStore } = useStore();
  const [selectedCity, setSelectedCity] = useState<'ALL' | 'Bengaluru' | 'Mysuru'>('ALL');

  const filteredStores = availableStores.filter((store) => {
    if (selectedCity !== 'ALL' && store.city !== selectedCity) return false;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto py-4">
      <h1 className="text-2xl sm:text-4xl font-black text-[#181614] mb-2 tracking-tight">
        Choose Your Neighborhood Store
      </h1>
      <p className="text-xs sm:text-sm text-[#78716C] mb-6 leading-relaxed">
        Select a store branch in your area. Each neighborhood store manages its own real-time physical inventory with ShelfSync.
      </p>

      <Alert type="info" className="mb-6">
        Each neighborhood branch has independent PostgreSQL inventory records. Switching stores will reset your cart if items from another store are present.
      </Alert>

      <div className="flex items-center gap-2 mb-6">
        {(['ALL', 'Bengaluru', 'Mysuru'] as const).map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => setSelectedCity(city)}
            className={`text-xs font-black px-4 py-2 rounded-full transition-all cursor-pointer ${
              selectedCity === city
                ? 'bg-[#0E2A22] text-[#F59E0B] shadow-md border border-[#1D4A3C]'
                : 'bg-white text-[#57534E] hover:bg-[#F3EFEA] border border-[#E3DDD2]'
            }`}
          >
            {city === 'ALL' ? 'All Stores' : `${city} Stores`}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredStores.map((store) => (
          <BranchCard
            key={store.id}
            store={store}
            isSelected={store.id === selectedStoreId}
            onSelect={() => selectStore(store)}
          />
        ))}
      </div>
    </div>
  );
}
