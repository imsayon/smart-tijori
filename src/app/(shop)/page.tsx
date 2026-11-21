'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/session/store-context';
import { api } from '@/lib/api-client';
import type { ProductOffer } from '@/contracts';
import { BranchBanner } from '@/components/shop/navigation/branch-banner';
import { SearchBar } from '@/components/shop/catalog/search-bar';
import { FilterPanel, type CategoryFilter } from '@/components/shop/catalog/filter-panel';
import { ProductGrid } from '@/components/shop/catalog/product-grid';
import { CatalogSkeleton } from '@/components/shop/feedback/loading-skeleton';

export default function HomePage() {
  const { selectedStoreId } = useStore();
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      try {
        setIsLoading(true);
        const res = await api.getProducts({
          storeId: selectedStoreId,
          q: searchQuery || undefined,
          category: category !== 'all' ? category : undefined,
        });
        if (active) {
          setProducts(res.items);
        }
      } catch (err) {
        console.error('Failed to load products', err);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadProducts();
    return () => {
      active = false;
    };
  }, [selectedStoreId, searchQuery, category]);

  const displayedProducts = inStockOnly
    ? products.filter((p) => p.available > 0)
    : products;

  return (
    <div>
      <BranchBanner />

      <div className="mb-6">
        <SearchBar
          query={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />
      </div>

      <FilterPanel
        selectedCategory={category}
        onSelectCategory={setCategory}
        inStockOnly={inStockOnly}
        onToggleInStock={setInStockOnly}
        totalCount={displayedProducts.length}
      />

      {isLoading ? (
        <CatalogSkeleton />
      ) : (
        <ProductGrid
          products={displayedProducts}
          emptyMessage="No products match your search or filter. Try clearing filters or searching for something else."
        />
      )}
    </div>
  );
}
