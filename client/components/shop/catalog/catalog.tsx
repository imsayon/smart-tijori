'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/session/store-context';
import { api } from '@/lib/api-client';
import type { ProductOffer } from '@/contracts';
import { parseRupeesToPaise } from '@/lib/utils/currency';
import { SearchBar } from '@/components/shop/catalog/search-bar';
import { FilterPanel, type CategoryFilter } from '@/components/shop/catalog/filter-panel';
import { ProductGrid } from '@/components/shop/catalog/product-grid';
import { CatalogSkeleton } from '@/components/shop/feedback/loading-skeleton';

export function Catalog({ initialQuery = '' }: { initialQuery?: string }) {
  const { selectedStoreId } = useStore();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const minPricePaise = minPrice ? parseRupeesToPaise(minPrice) : undefined;
  const maxPricePaise = maxPrice ? parseRupeesToPaise(maxPrice) : undefined;
  const priceError = Number(minPrice) < 0 || Number(maxPrice) < 0
    || !Number.isSafeInteger(minPricePaise ?? 0) || !Number.isSafeInteger(maxPricePaise ?? 0)
    || (minPricePaise ?? 0) > (maxPricePaise ?? Infinity);

  useEffect(() => {
    if (priceError) return;
    let active = true;
    async function loadProducts() {
      try {
        setIsLoading(true);
        setFailed(false);
        const res = await api.getProducts({
          storeId: selectedStoreId,
          q: searchQuery || undefined,
          category: category !== 'all' ? category : undefined,
          minPricePaise,
          maxPricePaise,
          includeUnavailable: !inStockOnly,
        });
        if (active) {
          setProducts(res.items);
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    const timer = window.setTimeout(loadProducts, 180);
    return () => {
      window.clearTimeout(timer);
      active = false;
    };
  }, [selectedStoreId, searchQuery, category, retry, inStockOnly, minPricePaise, maxPricePaise, priceError]);

  return (
    <>
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
        minPrice={minPrice}
        maxPrice={maxPrice}
        onMinPriceChange={setMinPrice}
        onMaxPriceChange={setMaxPrice}
        totalCount={priceError || failed || isLoading ? undefined : products.length}
      />

      {priceError ? (
        <p role="alert" className="py-8">Enter nonnegative prices with the minimum at or below the maximum.</p>
      ) : isLoading ? (
        <CatalogSkeleton />
      ) : failed ? (
        <div role="alert" className="py-8">The catalog is unavailable. <button className="underline" onClick={() => setRetry(n => n + 1)}>Try again</button></div>
      ) : (
        <ProductGrid
          products={products}
          emptyMessage="No products match your search or filter. Try clearing filters or searching for something else."
        />
      )}
    </>
  );
}
