import React from 'react';
import type { ProductOffer } from '@/contracts';
import { ProductCard } from '../product/product-card';

interface ProductGridProps {
  products: ProductOffer[];
  emptyMessage?: string;
}

export function ProductGrid({
  products,
  emptyMessage = 'No products found matching your criteria.',
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-[#E3DDD2] p-12 text-center my-6 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-[#F3EFEA] text-3xl flex items-center justify-center mx-auto mb-3 border border-[#E3DDD2]">
          📦
        </div>
        <h3 className="text-lg font-black text-[#181614] mb-1 tracking-tight">Catalog Empty</h3>
        <p className="text-sm text-[#78716C] max-w-md mx-auto leading-relaxed">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard key={product.productId} offer={product} />
      ))}
    </div>
  );
}
