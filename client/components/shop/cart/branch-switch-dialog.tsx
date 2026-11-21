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
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-2xl mb-4">
          ⚠️
        </div>
        <h3 id="switch-branch-title" className="text-xl font-bold text-stone-900 mb-2">
          Change fulfillment store?
        </h3>
        <p className="text-stone-600 text-sm leading-relaxed mb-4">
          You currently have{' '}
          <strong className="text-stone-900 font-semibold">{cartItemCount} item(s)</strong> in
          your cart from your current branch. SmartTijori operates single-branch carts to ensure
          accurate stock allocation.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-xs text-amber-900">
          <p className="font-semibold mb-1">Notice:</p>
          Switching to <strong>{pendingStoreSwitch.name}</strong> will reset your active cart and release any current checkout reservations.
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={cancelStoreSwitch}
            className="px-4 py-2 rounded-xl text-stone-600 font-medium hover:bg-stone-100 text-sm transition-colors"
          >
            Keep current store
          </button>
          <button
            type="button"
            onClick={confirmStoreSwitch}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-sm transition-colors focus:ring-2 focus:ring-amber-500"
          >
            Switch branch &amp; reset cart
          </button>
        </div>
      </div>
    </div>
  );
}
