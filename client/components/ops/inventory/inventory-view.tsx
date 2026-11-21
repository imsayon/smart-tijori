'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { OpsFacts } from '@/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { InventoryStockTable } from './inventory-stock-table';
import { InventoryMovementLedger } from './inventory-movement-ledger';

interface InventoryViewProps {
  storeId?: string;
  initialFacts?: OpsFacts | null;
}

type ViewState = 'loading' | 'success' | 'empty' | 'error' | 'pending_api';

export function InventoryView({ storeId, initialFacts }: InventoryViewProps) {
  const [facts, setFacts] = useState<OpsFacts | null>(initialFacts ?? null);
  const [state, setState] = useState<ViewState>(() => {
    if (initialFacts) {
      return initialFacts.stock.length === 0 ? 'empty' : 'success';
    }
    return 'pending_api';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const effectiveStoreId = facts?.storeId ?? storeId;

  const fetchInventoryFacts = useCallback(async () => {
    setState('loading');
    setErrorMessage(null);
    try {
      const data = await api.getOpsInventory();
      setFacts(data);
      setLastRefreshed(new Date());
      setState(data.stock.length === 0 ? 'empty' : 'success');
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        // HTTP 404 indicates the API handler is not yet wired
        setState('pending_api');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to load store inventory facts';
        setErrorMessage(message);
        setState('error');
      }
    }
  }, []);

  // Derived inventory metrics
  const metrics = useMemo(() => {
    if (!facts) return { totalSkus: 0, stockOnHand: 0, held: 0, available: 0 };
    return facts.stock.reduce(
      (acc, item) => ({
        totalSkus: acc.totalSkus + 1,
        stockOnHand: acc.stockOnHand + item.stockOnHand,
        held: acc.held + item.held,
        available: acc.available + item.available,
      }),
      { totalSkus: 0, stockOnHand: 0, held: 0, available: 0 }
    );
  }, [facts]);

  const filteredStock = useMemo(() => {
    if (!facts) return [];
    if (!searchTerm.trim()) return facts.stock;
    const term = searchTerm.toLowerCase();
    return facts.stock.filter((item) => item.productId.toLowerCase().includes(term));
  }, [facts, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E3DDD2]">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#78716C]">
            Operations Workbench · Store Inventory
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-[#181614] tracking-tight">
            Store Inventory Monitor
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#FAF8F5] text-[#0E2A22] border border-[#E3DDD2]">
            Store: <strong className="text-[#276350]">{effectiveStoreId ?? 'Session Authorized'}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-stone-100 text-[#57534E] border border-stone-200">
            Read-Only
          </span>
          <button
            type="button"
            onClick={fetchInventoryFacts}
            disabled={state === 'loading'}
            aria-label="Refresh inventory facts"
            className="p-1.5 rounded-xl border border-[#E3DDD2] bg-[#FAF8F5] hover:bg-[#F3EFEA] text-[#181614] transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh facts"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Loading State */}
      {state === 'loading' && (
        <div className="bg-white rounded-3xl border border-[#E3DDD2] p-12 text-center shadow-xs">
          <div className="text-3xl animate-spin mb-3">⏳</div>
          <h2 className="text-base font-black text-[#181614] mb-1">
            Loading Store Inventory Facts…
          </h2>
          <p className="text-xs text-[#78716C] font-mono">
            Contacting authoritative facts reader for {effectiveStoreId ? `branch ${effectiveStoreId}` : 'authorized branch'}
          </p>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <div className="bg-white rounded-3xl border border-red-200 p-8 sm:p-12 text-center space-y-4 max-w-2xl mx-auto shadow-xs">
          <div className="w-16 h-16 mx-auto bg-red-50 rounded-full flex items-center justify-center text-3xl border border-red-200">
            ⚠️
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-red-900 tracking-tight">
              Failed to Load Store Inventory
            </h2>
            <p className="text-xs sm:text-sm text-red-700 leading-relaxed max-w-lg mx-auto">
              {errorMessage || 'An error occurred while communicating with the inventory service.'}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={fetchInventoryFacts}
              className="inline-flex items-center gap-1.5 bg-[#276350] hover:bg-[#1E4D3E] text-white px-5 py-2.5 rounded-2xl text-xs font-mono font-bold transition-all shadow-xs cursor-pointer"
            >
              🔄 Retry Connection
            </button>
            <Link
              href="/ops/pos"
              className="inline-flex items-center gap-1.5 bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#E3DDD2] text-[#181614] px-5 py-2.5 rounded-2xl text-xs font-mono font-bold transition-all cursor-pointer"
            >
              ← Back to Active POS Terminal
            </Link>
          </div>
        </div>
      )}

      {/* Pending API State (Preserves existing Coming Soon disclosure while waiting for Sayon's route) */}
      {state === 'pending_api' && (
        <div className="bg-white rounded-3xl border border-[#E3DDD2] p-8 sm:p-12 text-center space-y-4 max-w-2xl mx-auto shadow-xs">
          <div className="w-16 h-16 mx-auto bg-amber-50 rounded-full flex items-center justify-center text-3xl border border-amber-200">
            📦
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
              ⏳ Coming Soon (Phase 3)
            </div>
            <h2 className="text-lg font-black text-[#181614] tracking-tight">
              Store Inventory Fact Projection Coming Soon
            </h2>
            <p className="text-xs sm:text-sm text-[#78716C] leading-relaxed max-w-lg mx-auto">
              This surface will display authoritative real-time inventory facts from PostgreSQL for{' '}
              <span className="font-mono font-bold text-[#0E2A22]">
                {effectiveStoreId ? `branch ${effectiveStoreId}` : 'your session-authorized branch'}
              </span>:
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
            <button
              type="button"
              onClick={fetchInventoryFacts}
              className="inline-flex items-center gap-1.5 bg-[#276350] hover:bg-[#1E4D3E] text-white px-5 py-2.5 rounded-2xl text-xs font-mono font-bold transition-all shadow-xs cursor-pointer"
            >
              🔄 Retry Connection
            </button>
            <Link
              href="/ops/pos"
              className="inline-flex items-center gap-1.5 bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#E3DDD2] text-[#181614] px-5 py-2.5 rounded-2xl text-xs font-mono font-bold transition-all cursor-pointer"
            >
              ← Back to Active POS Terminal
            </Link>
          </div>
        </div>
      )}

      {/* Empty State */}
      {state === 'empty' && (
        <div className="bg-white rounded-3xl border border-[#E3DDD2] p-12 text-center shadow-xs">
          <div className="text-3xl mb-2">📋</div>
          <h2 className="text-base font-black text-[#181614] mb-1">
            No Inventory Tracked for Store {effectiveStoreId ?? 'this Branch'}
          </h2>
          <p className="text-xs text-[#78716C] max-w-sm mx-auto">
            Zero active product records found in store inventory facts.
          </p>
        </div>
      )}

      {/* Success / Populated State */}
      {state === 'success' && facts && (
        <div className="space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
            <div className="bg-white rounded-2xl border border-[#E3DDD2] p-4 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-[#78716C] block">Tracked SKUs</span>
              <span className="text-2xl font-black text-[#181614] mt-1 block">
                {metrics.totalSkus}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E3DDD2] p-4 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-[#78716C] block">Stock on Hand</span>
              <span className="text-2xl font-black text-[#0E2A22] mt-1 block">
                {metrics.stockOnHand}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E3DDD2] p-4 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-[#78716C] block">Held Online (CartLock)</span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">
                {metrics.held}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-[#E3DDD2] p-4 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-[#78716C] block">Available to Sell</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                {metrics.available}
              </span>
            </div>
          </div>

          {/* Section: Stock Levels Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-[#181614]">Branch Stock Levels</h2>
                <p className="text-xs font-mono text-[#78716C]">
                  Per-SKU breakdown with real-time online holds and inventory version locks
                </p>
              </div>

              {/* Filter */}
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Filter by SKU / Product ID…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#E3DDD2] bg-white text-xs font-mono text-[#181614] placeholder:text-[#A8A29E] focus:outline-none focus:ring-1 focus:ring-[#276350]"
                />
              </div>
            </div>

            <InventoryStockTable stock={filteredStock} />
          </div>

          {/* Section: Stock Movement Ledger */}
          <div className="space-y-3 pt-2">
            <div>
              <h2 className="text-base font-black text-[#181614]">Recent Stock Movements</h2>
              <p className="text-xs font-mono text-[#78716C]">
                Authoritative audit ledger of last 20 atomic inventory events (POS, Online Orders, Restock)
              </p>
            </div>

            <InventoryMovementLedger movements={facts.recentMovements} />
          </div>

          {/* Footer Metadata */}
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E3DDD2] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-[#78716C]">
            <div>
              Checked at:{' '}
              <span className="font-bold text-[#181614]">
                {new Date(facts.checkedAt).toUTCString()}
              </span>
              {lastRefreshed && (
                <span className="ml-2 text-[#A8A29E]">
                  (Refreshed: {lastRefreshed.toLocaleTimeString()})
                </span>
              )}
            </div>
            <div className="text-right">
              Single-Stock Invariant: <span className="font-bold text-[#276350]">PostgreSQL Authoritative</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
