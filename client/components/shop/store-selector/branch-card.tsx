import React from 'react';
import type { Store } from '@/contracts';

interface BranchCardProps {
  store: Store;
  isSelected: boolean;
  onSelect: () => void;
}

export function BranchCard({ store, isSelected, onSelect }: BranchCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start justify-between gap-3 ${
        isSelected
          ? 'border-[#173F35] bg-[#F5F1E8]/70 shadow-sm'
          : 'border-stone-200 hover:border-stone-400 bg-white shadow-2xs hover:shadow-xs'
      }`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-extrabold text-stone-900 text-base">{store.name}</span>
          {store.area && (
            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              {store.area}
            </span>
          )}
          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-mono">
            {store.id}
          </span>
        </div>

        {store.address && (
          <p className="text-xs text-stone-600 mb-1 flex items-center gap-1">
            <span>📍</span>
            <span>{store.address}</span>
          </p>
        )}

        <p className="text-[11px] text-stone-500">
          City: <strong className="text-stone-700">{store.city}</strong> · Local stock verified
        </p>
      </div>

      <div className="mt-1">
        {isSelected ? (
          <span className="text-xs font-bold bg-[#173F35] text-white px-3 py-1.5 rounded-xl shadow-2xs">
            ✓ Current Store
          </span>
        ) : (
          <span className="text-xs font-bold text-[#173F35] bg-stone-100 hover:bg-[#173F35] hover:text-white px-3 py-1.5 rounded-xl transition-colors">
            Choose Store →
          </span>
        )}
      </div>
    </button>
  );
}
