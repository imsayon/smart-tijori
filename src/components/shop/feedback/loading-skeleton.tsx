import React from 'react';

export function ProductSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-[#E3DDD2] p-5 animate-pulse flex flex-col justify-between h-[380px] shadow-xs">
      <div className="bg-[#F3EFEA] rounded-2xl h-48 w-full mb-4 border border-[#EBE5DA]" />
      <div className="space-y-2.5">
        <div className="bg-[#EBE5DA] h-4 rounded-md w-3/4" />
        <div className="bg-[#F3EFEA] h-3 rounded-md w-1/2" />
      </div>
      <div className="flex justify-between items-center pt-4 border-t border-[#F0EBE1]">
        <div className="bg-[#EBE5DA] h-7 rounded-lg w-24" />
        <div className="bg-[#0E2A22]/10 h-10 rounded-full w-28" />
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
