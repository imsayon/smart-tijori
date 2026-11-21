'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/session/store-context';
import { api } from '@/lib/api-client';
import type { ProductOffer } from '@/contracts';
import { SearchBar } from '@/components/shop/catalog/search-bar';
import { ProductGrid } from '@/components/shop/catalog/product-grid';
import { CatalogSkeleton } from '@/components/shop/feedback/loading-skeleton';

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const { selectedStoreId, selectedStore } = useStore();

  const [query, setQuery] = useState(initialQuery);
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function performSearch() {
      try {
        setIsLoading(true);
        const res = await api.getProducts({
          storeId: selectedStoreId,
          q: query || undefined,
        });
        if (active) {
          setProducts(res.items);
        }
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    performSearch();
    return () => {
      active = false;
    };
  }, [selectedStoreId, query]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-[#181614] mb-2 tracking-tight">Search Catalog</h1>
        <p className="text-xs text-[#78716C] mb-4">
          Searching available stock at <span className="font-bold text-[#0E2A22]">{selectedStore?.name}</span>
        </p>
        <SearchBar query={query} onChange={setQuery} onClear={() => setQuery('')} />
      </div>

      <div className="mb-4 text-xs font-bold text-[#78716C]">
        Found {products.length} product(s)
      </div>

      {isLoading ? (
        <CatalogSkeleton />
      ) : (
        <ProductGrid
          products={products}
          emptyMessage={`No products match "${query}". Try searching for basmati, tea, detergent, oil, or spices.`}
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <SearchContent />
    </Suspense>
  );
}
