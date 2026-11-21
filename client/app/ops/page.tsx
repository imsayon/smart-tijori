import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Operations Overview | SmartTijori Workbench',
  description: 'Operations control overview, terminal status, inventory monitoring, and pipeline diagnostics.',
};

/**
 * Operations Overview landing page mounted at /ops.
 * Summarizes available operator workstreams and points to terminal, inventory, and diagnostics.
 */
export default function OpsOverviewPage() {
  return (
    <div className="space-y-6">
      {/* Overview Welcome & Branch Status */}
      <div className="bg-white rounded-3xl border border-[#E3DDD2] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🏪</span>
            <h1 className="text-xl sm:text-2xl font-black text-[#181614] tracking-tight">
              SmartTijori Operations Workbench
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#78716C] max-w-2xl leading-relaxed">
            Centralized terminal control, real-time single-stock authority monitoring, and asynchronous Kafka event telemetry for branch operations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3.5 py-2 rounded-2xl bg-[#FAF8F5] border border-[#E3DDD2] text-xs font-mono font-bold text-[#276350]">
            Branch: <span className="text-[#0E2A22]">Bengaluru (blr-01)</span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-[#FAF8F5] border border-[#E3DDD2] text-xs font-mono text-[#57534E]">
            Session: <span className="font-bold">staff01 (cashier)</span>
          </div>
        </div>
      </div>

      {/* Operations Quick Launch Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: In-Store POS Cashier Terminal (Active) */}
        <div className="bg-white rounded-3xl border-2 border-[#276350] p-6 shadow-sm flex flex-col justify-between space-y-4 relative overflow-hidden group">
          <div className="absolute top-4 right-4">
            <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-emerald-100 text-[#276350] px-2.5 py-1 rounded-full border border-emerald-300">
              Active Terminal
            </span>
          </div>
          <div className="space-y-2">
            <span className="text-3xl">🏪</span>
            <h2 className="text-lg font-black text-[#0E2A22] tracking-tight">
              In-Store Cashier POS
            </h2>
            <p className="text-xs text-[#57534E] leading-relaxed">
              Hardware barcode scanner stream with atomic CartLock protection. Automatically rejects in-store sales if stock is locked by an active 59-second online checkout hold.
            </p>
          </div>
          <Link
            href="/ops/pos"
            className="inline-flex items-center justify-center gap-2 w-full bg-[#276350] hover:bg-[#1E4D3E] text-white py-3 rounded-2xl font-mono text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Open POS Terminal →
          </Link>
        </div>

        {/* Card 2: Store Inventory Monitoring (Phase 3) */}
        <div className="bg-white rounded-3xl border border-[#E3DDD2] p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-3xl">📦</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
              Phase 3
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-[#181614] tracking-tight">
              Store Inventory Monitor
            </h2>
            <p className="text-xs text-[#78716C] leading-relaxed">
              Real-time authoritative SKU view: Stock on Hand, CartLock Held, and Available Unallocated stock. Includes last 20 stock movement events.
            </p>
          </div>
          <Link
            href="/ops/inventory"
            className="inline-flex items-center justify-center gap-2 w-full bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#E3DDD2] text-[#181614] py-3 rounded-2xl font-mono text-xs font-bold transition-all cursor-pointer"
          >
            View Inventory Status →
          </Link>
        </div>

        {/* Card 3: Pipeline & Worker Diagnostics (Phase 4) */}
        <div className="bg-white rounded-3xl border border-[#E3DDD2] p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-3xl">⚡</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
              Phase 4
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-[#181614] tracking-tight">
              Pipeline Diagnostics
            </h2>
            <p className="text-xs text-[#78716C] leading-relaxed">
              Kafka outbox telemetry, broker acknowledgments, projection progress into OpenSearch, retry backoffs, and quarantined poison pill monitor.
            </p>
          </div>
          <Link
            href="/ops/diagnostics"
            className="inline-flex items-center justify-center gap-2 w-full bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#E3DDD2] text-[#181614] py-3 rounded-2xl font-mono text-xs font-bold transition-all cursor-pointer"
          >
            View Diagnostics →
          </Link>
        </div>
      </div>

      {/* Architectural Boundaries & Single-Stock Truth Notice */}
      <div className="bg-[#FAF8F5] rounded-3xl border border-[#E3DDD2] p-6 text-xs text-[#57534E] space-y-2">
        <div className="flex items-center gap-2 font-bold text-[#181614]">
          <span>🛡️</span>
          <span>Architectural Single-Stock Invariant</span>
        </div>
        <p className="leading-relaxed">
          PostgreSQL alone allocates inventory. Domain state mutations and outbox intents commit in a single transaction. 
          No client-side stock allocation is performed in the Operations Workbench. Restocking requires authoritative platform owner command confirmation before mutation controls are enabled.
        </p>
      </div>
    </div>
  );
}
