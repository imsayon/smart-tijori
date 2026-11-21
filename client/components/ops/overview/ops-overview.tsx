'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { OpsFacts, PipelineFacts } from '@/contracts';
import { api, ApiClientError } from '@/lib/api-client';

interface OpsOverviewProps {
  storeId?: string;
  initialInventoryFacts?: OpsFacts | null;
  initialPipelineFacts?: PipelineFacts | null;
}

export function OpsOverview({
  storeId,
  initialInventoryFacts,
  initialPipelineFacts,
}: OpsOverviewProps) {
  const [inventoryFacts, setInventoryFacts] = useState<OpsFacts | null>(
    initialInventoryFacts ?? null
  );
  const [pipelineFacts, setPipelineFacts] = useState<PipelineFacts | null>(
    initialPipelineFacts ?? null
  );
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const effectiveStoreId = inventoryFacts?.storeId ?? pipelineFacts?.storeId ?? storeId;

  // Manual refresh attempt for both facts endpoints
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setInventoryError(null);
    setPipelineError(null);
    try {
      const [invRes, diagRes] = await Promise.allSettled([
        api.getOpsInventory(),
        api.getOpsDiagnostics(),
      ]);

      if (invRes.status === 'fulfilled') {
        setInventoryFacts(invRes.value);
        setInventoryError(null);
      } else {
        const err = invRes.reason;
        if (!(err instanceof ApiClientError && err.status === 404)) {
          setInventoryError(err instanceof Error ? err.message : 'Failed to load inventory facts');
        }
      }

      if (diagRes.status === 'fulfilled') {
        setPipelineFacts(diagRes.value);
        setPipelineError(null);
      } else {
        const err = diagRes.reason;
        if (!(err instanceof ApiClientError && err.status === 404)) {
          setPipelineError(err instanceof Error ? err.message : 'Failed to load pipeline diagnostics');
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Derived inventory metrics and operational warnings
  const inventoryMetrics = useMemo(() => {
    if (!inventoryFacts) return null;
    return inventoryFacts.stock.reduce(
      (acc, item) => {
        const isOutOfStock = item.available <= 0 && item.stockOnHand <= 0;
        const isLowStock = item.available > 0 && item.available <= 2;
        const isHeldLock = item.held > 0;

        return {
          totalSkus: acc.totalSkus + 1,
          stockOnHand: acc.stockOnHand + item.stockOnHand,
          held: acc.held + item.held,
          available: acc.available + item.available,
          outOfStockCount: acc.outOfStockCount + (isOutOfStock ? 1 : 0),
          lowStockCount: acc.lowStockCount + (isLowStock ? 1 : 0),
          heldLockCount: acc.heldLockCount + (isHeldLock ? 1 : 0),
        };
      },
      {
        totalSkus: 0,
        stockOnHand: 0,
        held: 0,
        available: 0,
        outOfStockCount: 0,
        lowStockCount: 0,
        heldLockCount: 0,
      }
    );
  }, [inventoryFacts]);

  return (
    <div className="space-y-6">
      {/* Overview Welcome & Branch Status */}
      <div className="bg-white rounded-3xl border border-[#E3DDD2] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl select-none" aria-hidden="true">🏪</span>
            <h1 className="text-xl sm:text-2xl font-black text-[#181614] tracking-tight">
              SmartTijori Operations Workbench
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#78716C] max-w-2xl leading-relaxed">
            Centralized terminal control, real-time single-stock authority monitoring, and asynchronous Kafka event telemetry for branch operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-2xl bg-[#FAF8F5] border border-[#E3DDD2] text-xs font-mono font-bold text-[#276350]">
            Branch: <span className="text-[#0E2A22]">{effectiveStoreId ?? 'Session Authorized'}</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-2xl bg-[#FAF8F5] border border-[#E3DDD2] text-xs font-mono text-[#57534E]">
            Mode: <span className="font-bold">Read-Only</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh operational facts"
            className="p-1.5 rounded-xl border border-[#E3DDD2] bg-[#FAF8F5] hover:bg-[#F3EFEA] text-[#181614] transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh facts"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Real-Time Operational Summaries Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Store Inventory Summary & Invariant Warnings */}
        <div className="bg-white rounded-3xl border border-[#E3DDD2] p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DDD2]">
              <div className="flex items-center gap-2">
                <span className="text-xl select-none">📦</span>
                <div>
                  <h2 className="text-base font-black text-[#181614] tracking-tight">
                    Store Inventory Summary
                  </h2>
                  <span className="text-[11px] font-mono text-[#78716C]">
                    PostgreSQL authoritative physical allocation
                  </span>
                </div>
              </div>
              <Link
                href="/ops/inventory"
                className="text-xs font-mono font-bold text-[#276350] hover:text-[#1E4D3E] underline"
              >
                View Full Inventory →
              </Link>
            </div>

            {/* Inventory Content: Active Facts vs Pending State */}
            {inventoryMetrics ? (
              <div className="space-y-4 font-mono">
                {/* 4 Core Inventory Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Tracked SKUs</span>
                    <span className="text-lg font-black text-[#181614] mt-0.5 block">{inventoryMetrics.totalSkus}</span>
                  </div>
                  <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">On Hand</span>
                    <span className="text-lg font-black text-[#0E2A22] mt-0.5 block">{inventoryMetrics.stockOnHand}</span>
                  </div>
                  <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Held Online</span>
                    <span className="text-lg font-black text-amber-700 mt-0.5 block">{inventoryMetrics.held}</span>
                  </div>
                  <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Available</span>
                    <span className="text-lg font-black text-emerald-700 mt-0.5 block">{inventoryMetrics.available}</span>
                  </div>
                </div>

                {/* Inventory Operational Warning Indicators */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] block">
                    Inventory Indicators & Alerts
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {inventoryMetrics.heldLockCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        🔒 {inventoryMetrics.heldLockCount} SKU(s) Held by 59s Online Locks
                      </span>
                    )}
                    {inventoryMetrics.lowStockCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        ⚠️ {inventoryMetrics.lowStockCount} Low Stock SKU(s)
                      </span>
                    )}
                    {inventoryMetrics.outOfStockCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                        ⛔ {inventoryMetrics.outOfStockCount} Out of Stock SKU(s)
                      </span>
                    )}
                    {inventoryMetrics.heldLockCount === 0 &&
                      inventoryMetrics.lowStockCount === 0 &&
                      inventoryMetrics.outOfStockCount === 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ✓ Healthy Inventory Allocation
                        </span>
                      )}
                  </div>
                </div>
              </div>
            ) : inventoryError ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center space-y-2 font-mono">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                  ⚠️ Error Loading Inventory
                </div>
                <p className="text-xs text-red-700 leading-relaxed max-w-sm mx-auto">
                  {inventoryError}
                </p>
              </div>
            ) : (
              <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-2xl p-5 text-center space-y-2 font-mono">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  ⏳ Route Approval Pending
                </div>
                <p className="text-xs text-[#78716C] leading-relaxed max-w-sm mx-auto">
                  Authoritative inventory facts pending platform integration (<span className="text-[#0E2A22] font-semibold">readOpsFacts</span>).
                </p>
                <Link
                  href="/ops/inventory"
                  className="inline-block text-[11px] font-bold text-[#276350] hover:underline pt-1"
                >
                  View Inventory Screen →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Pipeline Telemetry & Timestamps Summary */}
        <div className="bg-white rounded-3xl border border-[#E3DDD2] p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DDD2]">
              <div className="flex items-center gap-2">
                <span className="text-xl select-none">⚡</span>
                <div>
                  <h2 className="text-base font-black text-[#181614] tracking-tight">
                    Event Pipeline Telemetry
                  </h2>
                  <span className="text-[11px] font-mono text-[#78716C]">
                    Kafka outbox & version-guarded projection
                  </span>
                </div>
              </div>
              <Link
                href="/ops/diagnostics"
                className="text-xs font-mono font-bold text-[#276350] hover:text-[#1E4D3E] underline"
              >
                View Full Diagnostics →
              </Link>
            </div>

            {/* Pipeline Content: Active Facts vs Pending State */}
            {pipelineFacts ? (
              <div className="space-y-4 font-mono">
                {/* 4 Core Pipeline Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Pending Events</span>
                    <span className="text-lg font-black text-[#181614] mt-0.5 block">{pipelineFacts.pendingCount}</span>
                  </div>
                  <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Quarantine</span>
                    <span className={`text-lg font-black mt-0.5 block ${
                      pipelineFacts.quarantineCount + pipelineFacts.unattributedQuarantineCount > 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}>
                      {pipelineFacts.quarantineCount + pipelineFacts.unattributedQuarantineCount}
                    </span>
                  </div>
                  <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Retries</span>
                    <span className="text-lg font-black text-[#57534E] mt-0.5 block">{pipelineFacts.projectionRetryCount}</span>
                  </div>
                  <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Last Error</span>
                    <span className={`text-xs font-bold mt-1.5 block truncate ${
                      pipelineFacts.lastError ? 'text-red-700' : 'text-emerald-700'
                    }`} title={pipelineFacts.lastError?.code ?? 'Healthy'}>
                      {pipelineFacts.lastError ? pipelineFacts.lastError.code : 'None (Healthy)'}
                    </span>
                  </div>
                </div>

                {/* Broker & Projection Timestamps */}
                <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-2xl p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#57534E]">Last Broker Ack:</span>
                    <span className="font-bold text-[#0E2A22]">
                      {pipelineFacts.lastBrokerAckAt
                        ? new Date(pipelineFacts.lastBrokerAckAt).toLocaleTimeString()
                        : 'None recorded'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#57534E]">Last Projection Accepted:</span>
                    <span className="font-bold text-[#276350]">
                      {pipelineFacts.lastProjectionAcceptedAt
                        ? new Date(pipelineFacts.lastProjectionAcceptedAt).toLocaleTimeString()
                        : 'None accepted'}
                    </span>
                  </div>
                </div>
              </div>
            ) : pipelineError ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center space-y-2 font-mono">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                  ⚠️ Error Loading Telemetry
                </div>
                <p className="text-xs text-red-700 leading-relaxed max-w-sm mx-auto">
                  {pipelineError}
                </p>
              </div>
            ) : (
              <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-2xl p-5 text-center space-y-2 font-mono">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  ⏳ Route Approval Pending
                </div>
                <p className="text-xs text-[#78716C] leading-relaxed max-w-sm mx-auto">
                  Pipeline telemetry pending platform integration (<span className="text-[#0E2A22] font-semibold">createPipelineReader</span>).
                </p>
                <Link
                  href="/ops/diagnostics"
                  className="inline-block text-[11px] font-bold text-[#276350] hover:underline pt-1"
                >
                  View Diagnostics Screen →
                </Link>
              </div>
            )}
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
            <span className="text-3xl select-none">🏪</span>
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

        {/* Card 2: Store Inventory Monitoring */}
        <div className="bg-white rounded-3xl border border-[#E3DDD2] p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-3xl select-none">📦</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-[#276350] px-2 py-0.5 rounded-full border border-emerald-200">
              Live Monitor
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

        {/* Card 3: Pipeline & Worker Diagnostics */}
        <div className="bg-white rounded-3xl border border-[#E3DDD2] p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-3xl select-none">⚡</span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-[#276350] px-2 py-0.5 rounded-full border border-emerald-200">
              Live Monitor
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
          <span className="select-none">🛡️</span>
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
