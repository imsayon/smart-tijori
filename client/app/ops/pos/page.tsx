import React from 'react';
import type { Metadata } from 'next';
import { BarcodeSalePanel } from '@/components/ops/pos/barcode-sale-panel';

export const metadata: Metadata = {
  title: 'In-Store POS Terminal | Operations Workbench',
  description: 'Participating in-store barcode scanning terminal protected by single-stock CartLock hold authority.',
};

/**
 * Operations Cashier Terminal page mounted at /ops/pos.
 * Uses authenticated operator session for branch 'blr-01'.
 *
 * Store authority is server-verified:
 * - Session token 'ops_cashier_blr-01' strictly authorizes branch blr-01.
 * - The server-side operator guard rejects cross-store requests with HTTP 403.
 */
export default function PosCashierPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#78716C]">
            Terminal Service · Active
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-[#181614] tracking-tight">
            In-Store Cashier POS
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#E8F3EE] text-[#276350] border border-[#276350]/20">
            <span className="w-2 h-2 rounded-full bg-[#276350] animate-pulse" />
            Gate Connected (blr-01)
          </span>
        </div>
      </div>

      <BarcodeSalePanel storeId="blr-01" operatorId="cashier" />
    </div>
  );
}
