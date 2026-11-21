'use client';

import React from 'react';

export type CategoryFilter = 'all' | 'pantry' | 'household' | 'essentials';

interface FilterPanelProps {
  selectedCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
  inStockOnly: boolean;
  onToggleInStock: (val: boolean) => void;
  totalCount: number;
}

export function FilterPanel({
  selectedCategory,
  onSelectCategory,
  inStockOnly,
  onToggleInStock,
  totalCount,
}: FilterPanelProps) {
  const categories: Array<{ id: CategoryFilter; label: string; icon: string }> = [
    { id: 'all', label: 'All Items', icon: '🧺' },
    { id: 'pantry', label: 'Pantry', icon: '🌾' },
    { id: 'household', label: 'Household', icon: '🧼' },
    { id: 'essentials', label: 'Essentials', icon: '🧴' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-3.5 mb-6 border-b border-[#E3DDD2]">
      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Product categories">
        {categories.map((c) => {
          const isSelected = selectedCategory === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectCategory(c.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-[#0E2A22] text-[#F59E0B] shadow-md scale-102 border border-[#1D4A3C]'
                  : 'bg-white text-[#57534E] hover:bg-[#F3EFEA] hover:text-[#181614] border border-[#E3DDD2] shadow-xs'
              }`}
            >
              <span className="text-sm">{c.icon}</span>
              <span className="tracking-tight">{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* In-Stock filter & item count */}
      <div className="flex items-center gap-4 text-xs sm:text-sm text-[#57534E] self-end sm:self-auto">
        <label className="flex items-center gap-2 cursor-pointer select-none font-medium hover:text-[#181614] transition-colors">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onToggleInStock(e.target.checked)}
            className="w-4 h-4 rounded text-[#0E2A22] focus:ring-[#0E2A22] border-[#D1C9BC] accent-[#0E2A22]"
          />
          <span>In stock only</span>
        </label>
        <span className="text-[#D1C9BC]">|</span>
        <span className="font-mono text-xs bg-[#F3EFEA] text-[#14382C] font-black px-2.5 py-1 rounded-lg border border-[#E3DDD2]">
          {totalCount} {totalCount === 1 ? 'item' : 'items'}
        </span>
      </div>
    </div>
  );
}
