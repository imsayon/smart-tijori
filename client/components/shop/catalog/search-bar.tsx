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
  placeholder = 'Search pantry, household, essentials…',
}: SearchBarProps) {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 text-base">
        🔍
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-3 bg-white border border-stone-200 rounded-2xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-hidden focus:border-[#173F35] focus:ring-2 focus:ring-[#173F35]/20 shadow-2xs transition-all"
        aria-label="Search products"
      />
      {query && (
        <button
          type="button"
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 font-bold text-sm"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
