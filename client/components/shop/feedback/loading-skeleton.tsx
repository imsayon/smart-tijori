import React from 'react';

export function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 animate-pulse flex flex-col justify-between h-[360px]">
      <div className="bg-stone-200 rounded-xl h-44 w-full mb-3" />
      <div className="space-y-2">
        <div className="bg-stone-200 h-4 rounded-md w-3/4" />
        <div className="bg-stone-200 h-3 rounded-md w-1/2" />
      </div>
      <div className="flex justify-between items-center pt-4 border-t border-stone-100">
        <div className="bg-stone-200 h-6 rounded-md w-20" />
        <div className="bg-stone-200 h-9 rounded-lg w-24" />
      </div>
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </div>
  );
}
