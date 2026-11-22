import React from 'react';
import type { ProductOffer } from '@/contracts';
import { ProductCard } from '../product/product-card';
import { Icon } from '@/components/ui/atelier';

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
      <div className="atelier-panel p-8 my-6 text-center">
        <span className="inline-flex mb-2"><Icon name="shelf" size={22} /></span>
        <h3 className="text-lg font-semibold mb-1">Catalog Empty</h3>
        <p className="text-sm text-stone-600 max-w-md mx-auto">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
      {products.map((product) => (
        <ProductCard key={product.productId} offer={product} />
      ))}
    </div>
  );
}
