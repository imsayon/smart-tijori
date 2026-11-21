'use client';

import React from 'react';
import type { StockMovement } from '@/contracts';

interface InventoryMovementLedgerProps {
  movements: StockMovement[];
}

export function InventoryMovementLedger({ movements }: InventoryMovementLedgerProps) {
  if (movements.length === 0) {
    return (
      <div className="bg-[#FAF8F5] rounded-2xl border border-[#E3DDD2] p-8 text-center text-xs font-mono text-[#78716C]">
        No recent stock movements recorded for this branch.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E3DDD2] bg-white shadow-2xs">
      <table className="w-full text-left text-xs font-mono">
        <thead className="bg-[#FAF8F5] text-[#78716C] uppercase text-[10px] tracking-wider border-b border-[#E3DDD2]">
          <tr>
            <th scope="col" className="px-4 py-3 font-bold">Time (UTC)</th>
            <th scope="col" className="px-4 py-3 font-bold">Kind</th>
            <th scope="col" className="px-4 py-3 font-bold">Product / SKU</th>
            <th scope="col" className="px-4 py-3 font-bold text-right">Delta</th>
            <th scope="col" className="px-4 py-3 font-bold text-right">Reference ID</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3DDD2]/60 text-[#181614]">
          {movements.map((m, idx) => {
            const isNegative = m.quantityDelta < 0;
            const isPositive = m.quantityDelta > 0;

            const kindBadge =
              m.kind === 'ORDER' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  ORDER
                </span>
              ) : m.kind === 'POS' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  POS SALE
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  RESTOCK
                </span>
              );

            return (
              <tr key={`${m.referenceId}-${m.productId}-${idx}`} className="hover:bg-[#FAF8F5]/80 transition-colors">
                <td className="px-4 py-3 text-[#78716C] whitespace-nowrap">
                  {new Date(m.occurredAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </td>
                <td className="px-4 py-3">{kindBadge}</td>
                <td className="px-4 py-3 font-bold text-[#0E2A22]">{m.productId}</td>
                <td className="px-4 py-3 text-right font-black">
                  <span
                    className={
                      isNegative
                        ? 'text-red-600'
                        : isPositive
                        ? 'text-emerald-700'
                        : 'text-[#78716C]'
                    }
                  >
                    {isPositive ? `+${m.quantityDelta}` : m.quantityDelta}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[#57534E] font-medium max-w-xs truncate">
                  {m.referenceId}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
