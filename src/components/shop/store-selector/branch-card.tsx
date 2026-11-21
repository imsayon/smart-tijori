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
      className={`w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 flex items-start justify-between gap-3 cursor-pointer ${
        isSelected
          ? 'border-[#0E2A22] bg-gradient-to-br from-[#F5F2EB] to-[#EBE5DA] shadow-md ring-2 ring-[#0E2A22]/10'
          : 'border-[#E5DFD5] hover:border-[#C89B3C] bg-white shadow-xs hover:shadow-md'
      }`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="font-black text-[#181614] text-base sm:text-lg tracking-tight">
            {store.name}
          </span>
          {store.area && (
            <span className="text-[11px] bg-[#EAF4EE] text-[#14382C] font-black px-2.5 py-0.5 rounded-full border border-[#B8DEC8]">
              {store.area}
            </span>
          )}
          <span className="text-xs bg-[#F3EFEA] text-[#78716C] px-2 py-0.5 rounded-md font-mono font-medium">
            {store.id}
          </span>
        </div>

        {store.address && (
          <p className="text-xs text-[#57534E] mb-1.5 flex items-center gap-1.5">
            <span>📍</span>
            <span>{store.address}</span>
          </p>
        )}

        <p className="text-[11px] text-[#78716C]">
          City: <strong className="text-[#181614] font-bold">{store.city}</strong> · ShelfSync Counter Active
        </p>
      </div>

      <div className="mt-1 shrink-0">
        {isSelected ? (
          <span className="inline-flex items-center gap-1 text-xs font-black bg-[#0E2A22] text-[#F59E0B] px-3.5 py-1.5 rounded-full shadow-xs">
            <span>✓</span>
            <span>Current Store</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-black text-[#0E2A22] bg-[#F3EFEA] hover:bg-[#0E2A22] hover:text-white px-3.5 py-1.5 rounded-full transition-colors border border-[#E5DFD5]">
            <span>Choose Store</span>
            <span>→</span>
          </span>
        )}
      </div>
    </button>
  );
}
