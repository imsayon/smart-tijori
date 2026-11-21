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
      <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
        <div className="text-3xl mb-3">🔔</div>
        <h1 className="text-2xl font-black text-stone-900 mb-2">
          Save Stock Interest
        </h1>
        <p className="text-xs text-stone-500 mb-6 leading-relaxed">
          When high-demand items run out, registering interest informs our store replenishment and notifies your session once units are stocked.
        </p>

        {isSaved ? (
          <div>
            <Alert type="success" className="mb-6">
              <strong>Stock interest recorded!</strong> We have registered your intent for product{' '}
              <code className="font-mono text-xs bg-emerald-100 px-1 py-0.5 rounded-sm">
                {productId}
              </code>{' '}
              at store <code className="font-mono text-xs">{storeId}</code>.
            </Alert>
            <Link
              href="/"
              className="w-full block text-center bg-[#173F35] text-white font-bold py-3 px-4 rounded-xl text-sm"
            >
              Continue Shopping →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert type="error">{error}</Alert>}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Store Branch
              </label>
              <input
                type="text"
                readOnly
                value={storeId}
                className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs font-mono text-stone-700 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Product Identifier
              </label>
              <input
                type="text"
                readOnly
                value={productId}
                className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs font-mono text-stone-700 cursor-not-allowed"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !productId}
                className="w-full bg-[#173F35] hover:bg-[#275546] text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Recording…' : 'Confirm & Save Interest'}
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
    <Suspense fallback={<div className="max-w-lg mx-auto py-10 text-center text-stone-500">Loading form…</div>}>
      <InterestContent />
    </Suspense>
  );
}
