'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/session/store-context';
import { api } from '@/lib/api-client';
import type { ProductOffer } from '@/contracts';
import { ProductDetail } from '@/components/shop/product/product-detail';

function ProductDetailContent() {
  const params = useParams();
  const productId = params?.id as string;
  const { selectedStoreId } = useStore();

  const [offer, setOffer] = useState<ProductOffer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadOffer() {
      try {
        setIsLoading(true);
        const res = await api.getProducts({ storeId: selectedStoreId });
        const match = res.items.find((p) => p.productId === productId);
        if (active) {
          setOffer(match ?? null);
        }
      } catch (err) {
        console.error('Failed to load product details', err);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    if (productId) {
      loadOffer();
    }
    return () => {
      active = false;
    };
  }, [selectedStoreId, productId]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center text-stone-500 animate-pulse">
        Loading product facts from store authority…
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h2 className="text-xl font-bold text-stone-800 mb-2">Product Not Found</h2>
        <p className="text-xs text-stone-500 mb-4">
          This product is not offered at your current branch or does not exist.
        </p>
        <Link
          href="/"
          className="bg-[#173F35] text-white px-5 py-2.5 rounded-xl font-bold text-sm inline-block"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className="mb-4">
        <Link href="/" className="text-xs font-semibold text-stone-500 hover:text-stone-800">
          ← Back to Catalog
        </Link>
      </div>
      <ProductDetail offer={offer} />
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-16 text-center text-stone-500">Loading product…</div>}>
      <ProductDetailContent />
    </Suspense>
  );
}
