'use client';

import React from 'react';
import { useStore } from '@/lib/session/store-context';

export function BranchSwitchDialog() {
  const { pendingStoreSwitch, confirmStoreSwitch, cancelStoreSwitch, cartItemCount } = useStore();

  if (!pendingStoreSwitch) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-branch-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#E3DDD2] relative overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-amber-600" />

        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center text-2xl mb-4 border border-amber-200">
          ⚠️
        </div>
        <h3 id="switch-branch-title" className="text-xl font-black text-[#181614] mb-2 tracking-tight">
          Change fulfillment store?
        </h3>
        <p className="text-[#57534E] text-sm leading-relaxed mb-4">
          You currently have{' '}
          <strong className="text-[#181614] font-bold">{cartItemCount} item(s)</strong> in
          your cart from your current branch. SmartTijori operates single-branch carts to ensure
          accurate ShelfSync physical counter allocation.
        </p>
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 mb-6 text-xs text-amber-950 shadow-2xs leading-relaxed">
          <p className="font-black mb-1">Single-Branch Inventory Notice:</p>
          Switching to <strong>{pendingStoreSwitch.name}</strong> will reset your active cart and release any current checkout reservations.
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={cancelStoreSwitch}
            className="px-4 py-2.5 rounded-full text-[#78716C] font-bold hover:bg-[#F3EFEA] hover:text-[#181614] text-sm transition-colors cursor-pointer"
          >
            Keep current store
          </button>
          <button
            type="button"
            onClick={confirmStoreSwitch}
            className="px-6 py-2.5 rounded-full bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] font-black text-sm shadow-md transition-all active:scale-95 focus:ring-2 focus:ring-[#F59E0B] cursor-pointer border border-[#276350]/60"
          >
            Switch branch &amp; reset cart
          </button>
        </div>
      </div>
    </div>
  );
}
