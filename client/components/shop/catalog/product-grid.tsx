import React from 'react';
import type { ProductOffer } from '@/contracts';
import { ProductCard } from '../product/product-card';
import { Interactive3DCard } from '../atelier/interactive-3d-card';

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
      <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center my-6">
        <div className="text-4xl mb-3">📦</div>
        <h3 className="text-lg font-bold text-stone-800 mb-1">Catalog Empty</h3>
        <p className="text-sm text-stone-500 max-w-md mx-auto">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
      {products.map((product) => (
        <Interactive3DCard key={product.productId}>
          <ProductCard offer={product} />
        </Interactive3DCard>
      ))}
    </div>
  );
}
