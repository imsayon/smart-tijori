'use client';

import React from 'react';

interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

export function SearchBar({
  query,
  onChange,
  onClear,
  placeholder = 'Search local pantry, spices, grains, household essentials…',
}: SearchBarProps) {
  return (
    <div className="relative w-full group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#78716C] text-lg group-focus-within:text-[#0E2A22] transition-colors">
        🔍
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-12 pr-12 py-3.5 bg-white border border-[#E3DDD2] hover:border-[#C89B3C] rounded-2xl text-[#181614] placeholder:text-[#A8A29E] text-sm sm:text-base focus:outline-hidden focus:border-[#0E2A22] focus:ring-3 focus:ring-[#0E2A22]/10 shadow-xs hover:shadow-md transition-all duration-200"
        aria-label="Search products"
      />
      {query && (
        <button
          type="button"
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#78716C] hover:text-[#181614] font-bold text-base transition-colors"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
