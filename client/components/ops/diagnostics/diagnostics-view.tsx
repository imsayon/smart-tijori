'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import type { PipelineFacts } from '@/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { PipelineMetricCards } from './pipeline-metric-cards';
import { PipelineEventsTable } from './pipeline-events-table';

interface DiagnosticsViewProps {
  storeId?: string;
  initialFacts?: PipelineFacts | null;
}

type ViewState = 'loading' | 'success' | 'empty' | 'error' | 'pending_api';

export function DiagnosticsView({ storeId, initialFacts }: DiagnosticsViewProps) {
  const [facts, setFacts] = useState<PipelineFacts | null>(initialFacts ?? null);
  const [state, setState] = useState<ViewState>(() => {
    if (initialFacts) {
      return initialFacts.recentEvents.length === 0 && initialFacts.pendingCount === 0
        ? 'empty'
        : 'success';
    }
    return 'pending_api';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const effectiveStoreId = facts?.storeId ?? storeId;

  const fetchPipelineFacts = useCallback(async () => {
    setState('loading');
    setErrorMessage(null);
    try {
      const data = await api.getOpsDiagnostics();
      setFacts(data);
      setLastRefreshed(new Date());
      setState(
        data.recentEvents.length === 0 && data.pendingCount === 0 ? 'empty' : 'success'
      );
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        setState('pending_api');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to load pipeline diagnostics';
        setErrorMessage(message);
        setState('error');
      }
    }
  }, []);

  return (
    <div className="atelier-diagnostics space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E3DDD2]">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#78716C]">
            Operations Workbench · Observability
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-[#181614] tracking-tight">
            Pipeline & Worker Diagnostics
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
            onClick={fetchPipelineFacts}
            disabled={state === 'loading'}
            aria-label="Refresh pipeline diagnostics"
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
            Loading Pipeline Facts…
          </h2>
          <p className="text-xs text-[#78716C] font-mono">
            Contacting outbox telemetry reader for {effectiveStoreId ? `branch ${effectiveStoreId}` : 'authorized branch'}
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
              Failed to Load Pipeline Diagnostics
            </h2>
            <p className="text-xs sm:text-sm text-red-700 leading-relaxed max-w-lg mx-auto">
              {errorMessage || 'An error occurred while communicating with the telemetry reader.'}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={fetchPipelineFacts}
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
            ⚡
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
              ⏳ Coming Soon (Phase 4)
            </div>
            <h2 className="text-lg font-black text-[#181614] tracking-tight">
              Kafka Outbox & Worker Telemetry Coming Soon
            </h2>
            <p className="text-xs sm:text-sm text-[#78716C] leading-relaxed max-w-lg mx-auto">
              This surface will display live projection pipeline health and event publication telemetry for{' '}
              <span className="font-mono font-bold text-[#0E2A22]">
                {effectiveStoreId ? `branch ${effectiveStoreId}` : 'your session-authorized branch'}
              </span>:
            </p>
          </div>

          <div className="bg-[#FAF8F5] rounded-2xl border border-[#E3DDD2] p-4 text-left space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between py-1 border-b border-[#E3DDD2]/60">
              <span className="text-[#57534E]">Authoritative Telemetry Reader:</span>
              <span className="font-bold text-[#0E2A22]">server/events/diagnostics.ts (createPipelineReader)</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3DDD2]/60">
              <span className="text-[#57534E]">Outbox Queue Depth:</span>
              <span className="font-bold text-[#0E2A22]">pendingCount & oldestPendingAt</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3DDD2]/60">
              <span className="text-[#57534E]">Kafka Broker Acknowledgment:</span>
              <span className="font-bold text-[#0E2A22]">lastBrokerAckAt</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3DDD2]/60">
              <span className="text-[#57534E]">OpenSearch Projection Progress:</span>
              <span className="font-bold text-[#0E2A22]">lastProjectionAcceptedAt</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[#57534E]">Quarantine Monitor:</span>
              <span className="font-bold text-[#0E2A22]">quarantineCount (poison pill isolation)</span>
            </div>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={fetchPipelineFacts}
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
            No Outbox Telemetry Logged
          </h2>
          <p className="text-xs text-[#78716C] max-w-sm mx-auto">
            Zero pending or published events recorded for store {effectiveStoreId ?? 'this branch'}.
          </p>
        </div>
      )}

      {/* Success / Populated State */}
      {state === 'success' && facts && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <PipelineMetricCards facts={facts} />

          {/* Recent Outbox Events Table */}
          <div className="space-y-3 pt-2">
            <div>
              <h2 className="text-base font-black text-[#181614]">Recent Outbox Events</h2>
              <p className="text-xs font-mono text-[#78716C]">
                Last 20 domain events recorded in transactional outbox for asynchronous Kafka publication
              </p>
            </div>

            <PipelineEventsTable events={facts.recentEvents} />
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
              Outbox Invariant: <span className="font-bold text-[#276350]">At-Least-Once Delivery</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
