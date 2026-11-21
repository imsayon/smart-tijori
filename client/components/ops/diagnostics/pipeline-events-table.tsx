'use client';

import React from 'react';
import type { RecentPipelineEvent } from '@/contracts';

interface PipelineEventsTableProps {
  events: RecentPipelineEvent[];
}

export function PipelineEventsTable({ events }: PipelineEventsTableProps) {
  if (events.length === 0) {
    return (
      <div className="bg-[#FAF8F5] rounded-2xl border border-[#E3DDD2] p-8 text-center text-xs font-mono text-[#78716C]">
        No recent store activity recorded for this branch.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E3DDD2] bg-white shadow-2xs font-mono">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#FAF8F5] text-[#78716C] uppercase text-[10px] tracking-wider border-b border-[#E3DDD2]">
          <tr>
            <th scope="col" className="px-4 py-3 font-bold">Reference</th>
            <th scope="col" className="px-4 py-3 font-bold">Type</th>
            <th scope="col" className="px-4 py-3 font-bold">Recorded at</th>
            <th scope="col" className="px-4 py-3 font-bold">Shared at</th>
            <th scope="col" className="px-4 py-3 font-bold text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3DDD2]/60 text-[#181614]">
          {events.map((evt) => {
            const isPublished = Boolean(evt.publishedAt);

            const typeBadge =
              evt.type === 'inventory.changed' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Stock updated
                </span>
              ) : evt.type === 'order.placed' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  Order placed
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-200">
                  {evt.type}
                </span>
              );

            return (
              <tr key={evt.eventId} className="hover:bg-[#FAF8F5]/80 transition-colors">
                <td className="px-4 py-3 font-bold text-[#0E2A22] max-w-[140px] truncate" title={evt.eventId}>
                  {evt.eventId}
                </td>
                <td className="px-4 py-3">{typeBadge}</td>
                <td className="px-4 py-3 text-[#78716C] whitespace-nowrap">
                  {new Date(evt.occurredAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </td>
                <td className="px-4 py-3 text-[#78716C] whitespace-nowrap">
                  {evt.publishedAt ? (
                    new Date(evt.publishedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })
                  ) : (
                    <span className="text-amber-700 font-bold">Not shared yet</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {isPublished ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Shared
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
