import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Store Inventory Monitoring | Operations Workbench',
  description: 'Real-time per-SKU inventory visibility, stock-on-hand, online holds, and stock movement ledger.',
};

/**
 * Operations Inventory Monitor page mounted at /ops/inventory.
 * Currently in "Coming soon" state pending Sayon's GET /api/ops/inventory route integration.
 * Does not invent mock data or implement client-side allocation.
 */
export default function OpsInventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#78716C]">
            Inventory Monitoring · Planned Phase 3
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-[#181614] tracking-tight">
            Store Inventory Monitor
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
            ⏳ Coming Soon (Phase 3)
          </span>
        </div>
      </div>

      {/* Coming Soon Disclosure Card */}
      <div className="bg-white rounded-3xl border border-[#E3DDD2] p-8 sm:p-12 text-center space-y-4 max-w-2xl mx-auto shadow-xs">
        <div className="w-16 h-16 mx-auto bg-amber-50 rounded-full flex items-center justify-center text-3xl border border-amber-200">
          📦
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-black text-[#181614] tracking-tight">
            Store Inventory Fact Projection Coming Soon
          </h2>
          <p className="text-xs sm:text-sm text-[#78716C] leading-relaxed max-w-lg mx-auto">
            This surface will display authoritative real-time inventory facts from PostgreSQL for branch <span className="font-mono font-bold text-[#0E2A22]">blr-01</span>:
          </p>
        </div>

        <div className="bg-[#FAF8F5] rounded-2xl border border-[#E3DDD2] p-4 text-left space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between py-1 border-b border-[#E3DDD2]/60">
            <span className="text-[#57534E]">Authoritative Data Source:</span>
            <span className="font-bold text-[#0E2A22]">server/commerce/facts.ts (readOpsFacts)</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-[#E3DDD2]/60">
            <span className="text-[#57534E]">Stock on Hand vs Held:</span>
            <span className="font-bold text-[#0E2A22]">available = stockOnHand - held</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-[#E3DDD2]/60">
            <span className="text-[#57534E]">Audit Ledger:</span>
            <span className="font-bold text-[#0E2A22]">Last 20 events (ORDER, POS, RESTOCK)</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[#57534E]">Restock Status:</span>
            <span className="text-amber-800 font-bold">Awaiting platform owner command confirmation</span>
          </div>
        </div>

        <div className="pt-2 flex justify-center gap-3">
          <Link
            href="/ops/pos"
            className="inline-flex items-center gap-1.5 bg-[#276350] hover:bg-[#1E4D3E] text-white px-5 py-2.5 rounded-2xl text-xs font-mono font-bold transition-all shadow-xs cursor-pointer"
          >
            ← Back to Active POS Terminal
          </Link>
          <Link
            href="/ops"
            className="inline-flex items-center gap-1.5 bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#E3DDD2] text-[#181614] px-5 py-2.5 rounded-2xl text-xs font-mono font-bold transition-all cursor-pointer"
          >
            Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
