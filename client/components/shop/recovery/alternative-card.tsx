'use client';

import React from 'react';
import type { RecoveryCandidate, ProductOffer } from '@/contracts';
import { formatPaise } from '@/lib/utils/currency';

interface AlternativeCardProps {
  candidate: RecoveryCandidate;
  unavailableOffer?: ProductOffer | null;
  onApprove: (offer: ProductOffer) => void;
  isApproving?: boolean;
}

export function AlternativeCard({
  candidate,
  unavailableOffer,
  onApprove,
  isApproving,
}: AlternativeCardProps) {
  const offer = candidate.offer ?? (candidate as unknown as { product?: ProductOffer }).product;
  const reasons = candidate.reasons ?? [];

  if (!offer) {
    return null;
  }

  // Authoritative stock availability resolution
  const availableStockNumber =
    (offer as unknown as { availableStock?: number; availableUnits?: number }).availableStock ??
    (offer as unknown as { availableUnits?: number }).availableUnits;
  const stockDisplay =
    typeof availableStockNumber === 'number' && availableStockNumber > 0
      ? `${availableStockNumber} in stock`
      : typeof offer.available === 'number' && offer.available > 0
      ? `${offer.available} in stock`
      : offer.available
      ? 'In stock'
      : 'Out of stock';

  return (
    <div className="bg-white rounded-2xl border-2 border-emerald-700/30 hover:border-emerald-700 p-5 shadow-xs flex flex-col justify-between transition-all">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs bg-emerald-100 text-emerald-900 font-bold px-2.5 py-0.5 rounded-full">
            Verified Alternative
          </span>
          <span className="text-xs text-stone-500 font-mono">
            {offer.pack.quantity} {offer.pack.unit}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            {stockDisplay}
          </span>
        </div>

        <h4 className="font-bold text-stone-900 text-base mb-2">{offer.name}</h4>

        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xl font-black text-[#173F35]">
            {formatPaise(offer.pricePaise)}
          </span>
          {unavailableOffer && (
            <span className="text-xs text-stone-500">
              (vs {formatPaise(unavailableOffer.pricePaise)})
            </span>
          )}
        </div>

        {/* Factual Reasons List */}
        <div className="bg-[#FAF8F5] p-3 rounded-xl border border-stone-200 mb-4 space-y-1.5">
          <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Verified Replacement Facts:
          </div>
          {reasons.map((reason, idx) => (
            <div key={idx} className="text-xs text-stone-700 flex items-start gap-1.5">
              <span className="text-emerald-700 font-bold select-none">✓</span>
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onApprove(offer)}
        disabled={isApproving}
        className="w-full bg-[#173F35] hover:bg-[#275546] active:scale-98 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-xs focus:ring-2 focus:ring-lime-400 disabled:opacity-50"
      >
        {isApproving ? 'Updating Cart…' : 'Approve this replacement →'}
      </button>
    </div>
  );
}
