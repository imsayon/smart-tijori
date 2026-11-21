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
  const { offer, reasons } = candidate;

  return (
    <div className="bg-white rounded-3xl border-2 border-[#1D4A3C]/40 hover:border-[#0E2A22] p-5 sm:p-6 shadow-sm hover:shadow-lg flex flex-col justify-between transition-all duration-200 relative overflow-hidden group">
      {/* Decorative side accent */}
      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-[#C89B3C] to-[#0E2A22]" />

      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs bg-[#EAF4EE] text-[#14382C] font-black px-2.5 py-0.5 rounded-full border border-[#B8DEC8]">
            Verified Alternative
          </span>
          <span className="text-xs text-[#78716C] font-mono font-semibold bg-[#F3EFEA] px-2 py-0.5 rounded-md border border-[#E3DDD2]">
            {offer.pack.quantity} {offer.pack.unit}
          </span>
        </div>

        <h4 className="font-black text-[#181614] text-base sm:text-lg mb-2 leading-snug tracking-tight">
          {offer.name}
        </h4>

        <div className="flex items-baseline gap-2 mb-3.5">
          <span className="text-2xl font-black text-[#0E2A22] tracking-tight">
            {formatPaise(offer.pricePaise)}
          </span>
          {unavailableOffer && (
            <span className="text-xs text-[#78716C] font-medium">
              (vs {formatPaise(unavailableOffer.pricePaise)})
            </span>
          )}
        </div>

        {/* Factual Reasons List */}
        <div className="bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E3DDD2] mb-5 space-y-1.5">
          <div className="text-[10px] font-black text-[#78716C] uppercase tracking-wider mb-1">
            Verified Replacement Facts:
          </div>
          {reasons.map((reason, idx) => (
            <div key={idx} className="text-xs text-[#383531] flex items-start gap-2">
              <span className="text-[#0E2A22] font-black select-none mt-0.5">✓</span>
              <span className="leading-relaxed">{reason}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onApprove(offer)}
        disabled={isApproving}
        className="w-full bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] font-black text-xs sm:text-sm py-3 px-4 rounded-xl transition-all duration-150 shadow-sm hover:shadow-md active:scale-98 disabled:opacity-50 cursor-pointer border border-[#276350]/60 focus:ring-2 focus:ring-[#F59E0B]"
      >
        {isApproving ? 'Updating Cart…' : 'Approve this replacement →'}
      </button>
    </div>
  );
}
