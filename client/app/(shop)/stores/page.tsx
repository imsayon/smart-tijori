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
      <h1 className="text-2xl sm:text-3xl font-black text-stone-900 mb-2">
        Choose Your Neighborhood Store
      </h1>
      <p className="text-xs sm:text-sm text-stone-600 mb-6">
        Select a store branch in your area. Each neighborhood store manages its own real-time physical inventory.
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
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
              selectedCity === city
                ? 'bg-[#173F35] text-white shadow-xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
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
