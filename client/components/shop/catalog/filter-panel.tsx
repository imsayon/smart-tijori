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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-3 mb-6 border-b border-stone-200">
      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Product categories">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={selectedCategory === c.id}
            onClick={() => onSelectCategory(c.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              selectedCategory === c.id
                ? 'bg-[#173F35] text-white shadow-xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* In-Stock filter & item count */}
      <div className="flex items-center gap-4 text-xs sm:text-sm text-stone-600 self-end sm:self-auto">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onToggleInStock(e.target.checked)}
            className="w-4 h-4 rounded-md text-[#173F35] focus:ring-[#173F35] border-stone-300"
          />
          <span className="font-medium">In-stock only</span>
        </label>
        <span className="text-stone-400">|</span>
        <span className="font-semibold text-stone-700">{totalCount} products</span>
      </div>
    </div>
  );
}
