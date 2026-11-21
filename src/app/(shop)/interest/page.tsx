'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Alert } from '@/components/shop/feedback/alert';

function InterestContent() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId') ?? 'blr-01';
  const productId = searchParams.get('productId') ?? '';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await api.saveInterest(storeId, productId);
      setIsSaved(true);
    } catch {
      setError('Failed to record stock interest. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <div className="bg-white rounded-3xl border border-[#E3DDD2] p-8 sm:p-10 shadow-xl relative overflow-hidden">
        {/* Top subtle brass trim */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0E2A22] via-[#C89B3C] to-[#0E2A22]" />

        <div className="w-14 h-14 rounded-2xl bg-[#F3EFEA] text-[#0E2A22] flex items-center justify-center text-3xl mb-4 border border-[#E3DDD2]">
          🔔
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#181614] mb-2 tracking-tight">
          Save Stock Interest
        </h1>
        <p className="text-xs sm:text-sm text-[#78716C] mb-6 leading-relaxed">
          When high-demand items run out, registering interest informs our store replenishment and notifies your session once units are stocked.
        </p>

        {isSaved ? (
          <div>
            <Alert type="success" className="mb-6">
              <strong>Stock interest recorded!</strong> We have registered your intent for product{' '}
              <code className="font-mono text-xs bg-white text-[#0E2A22] px-1.5 py-0.5 rounded-md border border-[#B8DEC8]">
                {productId}
              </code>{' '}
              at store <code className="font-mono text-xs bg-white text-[#0E2A22] px-1.5 py-0.5 rounded-md border border-[#B8DEC8]">{storeId}</code>.
            </Alert>
            <Link
              href="/"
              className="w-full block text-center bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] font-black py-3.5 px-6 rounded-full text-sm shadow-md transition-all active:scale-95"
            >
              Continue Shopping →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert type="error">{error}</Alert>}

            <div>
              <label className="block text-xs font-bold text-[#181614] uppercase tracking-wider mb-1.5">
                Target Product ID
              </label>
              <input
                type="text"
                readOnly
                value={productId}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#FAF8F5] text-xs font-mono text-[#57534E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#181614] uppercase tracking-wider mb-1.5">
                Branch Store
              </label>
              <input
                type="text"
                readOnly
                value={storeId}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#FAF8F5] text-xs font-mono text-[#57534E]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !productId}
                className="w-full bg-[#0E2A22] hover:bg-[#163D31] active:scale-95 text-[#FAF8F5] font-black text-sm py-3.5 px-6 rounded-full transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer border border-[#276350]/60"
              >
                {isSubmitting ? 'Recording Interest…' : 'Confirm Stock Interest →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function InterestPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-lg mx-auto py-10 px-4 text-center text-[#78716C] animate-pulse">
          Loading stock interest form…
        </div>
      }
    >
      <InterestContent />
    </Suspense>
  );
}
