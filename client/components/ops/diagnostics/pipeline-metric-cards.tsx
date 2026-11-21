'use client';

import React from 'react';
import type { PipelineFacts } from '@/contracts';

interface PipelineMetricCardsProps {
  facts: PipelineFacts;
}

export function PipelineMetricCards({ facts }: PipelineMetricCardsProps) {
  const hasQuarantine = facts.quarantineCount > 0 || facts.unattributedQuarantineCount > 0;
  const hasError = facts.lastError !== null;
  const hasPending = facts.pendingCount > 0;
  const hasRetries = facts.projectionRetryCount > 0;
  const isUnconfirmed = facts.lastBrokerAckAt === null || facts.lastProjectionAcceptedAt === null;

  let bannerConfig: {
    icon: string;
    headline: string;
    badgeText: string;
    containerClass: string;
  };

  if (hasQuarantine) {
    bannerConfig = {
      icon: '🚨',
      headline: 'Poison Pill Quarantine Active',
      badgeText: 'ATTENTION REQUIRED',
      containerClass: 'bg-red-50 border-red-300 text-red-900',
    };
  } else if (hasError) {
    bannerConfig = {
      icon: '⚠️',
      headline: `Pipeline Error: ${facts.lastError?.code}`,
      badgeText: 'ATTENTION REQUIRED',
      containerClass: 'bg-red-50 border-red-300 text-red-900',
    };
  } else if (hasPending) {
    bannerConfig = {
      icon: '⏳',
      headline: `${facts.pendingCount} Outbox Events Pending Publication`,
      badgeText: 'ATTENTION REQUIRED',
      containerClass: 'bg-amber-50 border-amber-300 text-amber-900',
    };
  } else if (hasRetries) {
    bannerConfig = {
      icon: '⚠️',
      headline: `${facts.projectionRetryCount} Projection Retries in Progress`,
      badgeText: 'ATTENTION REQUIRED',
      containerClass: 'bg-amber-50 border-amber-300 text-amber-900',
    };
  } else if (isUnconfirmed) {
    const unconfirmedMessage =
      facts.lastBrokerAckAt === null && facts.lastProjectionAcceptedAt === null
        ? 'Awaiting Initial Broker Ack & Projection Progress'
        : facts.lastBrokerAckAt === null
        ? 'Awaiting Initial Kafka Broker Acknowledgment'
        : 'Awaiting Initial OpenSearch Projection Acceptance';

    bannerConfig = {
      icon: '⏸️',
      headline: unconfirmedMessage,
      badgeText: 'UNCONFIRMED / IDLE',
      containerClass: 'bg-stone-100 border-stone-300 text-stone-800',
    };
  } else {
    bannerConfig = {
      icon: '✅',
      headline: 'All Events Published & Projected',
      badgeText: 'HEALTHY',
      containerClass: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    };
  }

  return (
    <div className="space-y-4 font-mono">
      {/* Top Level Pipeline Health Banner */}
      <div
        className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${bannerConfig.containerClass}`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl select-none" aria-hidden="true">
            {bannerConfig.icon}
          </span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">
              Pipeline Health Status
            </div>
            <div className="text-sm font-black">
              {bannerConfig.headline}
            </div>
          </div>
        </div>

        <div className="text-xs flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/80 border border-current">
            {bannerConfig.badgeText}
          </span>
        </div>
      </div>

      {/* Metric Tiles Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Pending Outbox Count */}
        <div className="bg-white rounded-2xl border border-[#E3DDD2] p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#78716C] block">
            Outbox Queue Depth
          </span>
          <span className="text-2xl font-black text-[#181614] mt-1 block">
            {facts.pendingCount}
          </span>
          <span className="text-[11px] text-[#78716C] mt-1 block truncate">
            {facts.oldestPendingAt
              ? `Oldest: ${new Date(facts.oldestPendingAt).toLocaleTimeString()}`
              : 'Zero backlog'}
          </span>
        </div>

        {/* Kafka Broker Acknowledgment */}
        <div className="bg-white rounded-2xl border border-[#E3DDD2] p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#78716C] block">
            Last Kafka Broker Ack
          </span>
          <span className="text-lg font-black text-[#0E2A22] mt-1 block truncate">
            {facts.lastBrokerAckAt
              ? new Date(facts.lastBrokerAckAt).toLocaleTimeString()
              : 'None recorded'}
          </span>
          <span className="text-[11px] text-[#78716C] mt-1 block truncate">
            {facts.lastBrokerAckAt
              ? new Date(facts.lastBrokerAckAt).toLocaleDateString()
              : 'Awaiting publish'}
          </span>
        </div>

        {/* Projection Progress */}
        <div className="bg-white rounded-2xl border border-[#E3DDD2] p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#78716C] block">
            Last Projection Accepted
          </span>
          <span className="text-lg font-black text-[#276350] mt-1 block truncate">
            {facts.lastProjectionAcceptedAt
              ? new Date(facts.lastProjectionAcceptedAt).toLocaleTimeString()
              : 'None accepted'}
          </span>
          <span className="text-[11px] text-[#78716C] mt-1 block truncate">
            {facts.lastProjectionAcceptedAt
              ? new Date(facts.lastProjectionAcceptedAt).toLocaleDateString()
              : 'OpenSearch writer'}
          </span>
        </div>

        {/* Quarantine & Retries */}
        <div className="bg-white rounded-2xl border border-[#E3DDD2] p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-[#78716C] block">
            Quarantine & Retries
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-black ${
                hasQuarantine ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {facts.quarantineCount + facts.unattributedQuarantineCount}
            </span>
            <span className="text-xs text-[#78716C]">
              quarantined / {facts.projectionRetryCount} retries
            </span>
          </div>
          <span className="text-[11px] text-[#78716C] mt-1 block truncate">
            {facts.unattributedQuarantineCount > 0
              ? `(${facts.unattributedQuarantineCount} unattributed)`
              : 'Poison pill isolation'}
          </span>
        </div>
      </div>

      {/* Last Error Notice (if any) */}
      {facts.lastError && (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-red-800 font-bold mb-1">
            <span>⚠️</span>
            <span>Last Pipeline Error: {facts.lastError.code}</span>
          </div>
          <p className="text-red-700">
            Recorded at: {new Date(facts.lastError.at).toUTCString()}
          </p>
        </div>
      )}
    </div>
  );
}
