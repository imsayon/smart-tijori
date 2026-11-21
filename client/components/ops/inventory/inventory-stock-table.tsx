'use client';

import React from 'react';
import type { OpsStockItem } from '@/contracts';

interface InventoryStockTableProps {
  stock: OpsStockItem[];
}

export function InventoryStockTable({ stock }: InventoryStockTableProps) {
  if (stock.length === 0) {
    return (
      <div className="bg-[#FAF8F5] rounded-2xl border border-[#E3DDD2] p-8 text-center text-xs font-mono text-[#78716C]">
        No SKU inventory records available for this branch.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E3DDD2] bg-white shadow-2xs">
      <table className="w-full text-left text-xs font-mono">
        <thead className="bg-[#FAF8F5] text-[#78716C] uppercase text-[10px] tracking-wider border-b border-[#E3DDD2]">
          <tr>
            <th scope="col" className="px-4 py-3 font-bold">Product / SKU</th>
            <th scope="col" className="px-4 py-3 font-bold text-right">On Hand</th>
            <th scope="col" className="px-4 py-3 font-bold text-right">Held (CartLock)</th>
            <th scope="col" className="px-4 py-3 font-bold text-right">Available</th>
            <th scope="col" className="px-4 py-3 font-bold text-center">Version</th>
            <th scope="col" className="px-4 py-3 font-bold text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3DDD2]/60 text-[#181614]">
          {stock.map((item) => {
            const isOutOfStock = item.available <= 0 && item.stockOnHand <= 0;
            const isHeldLock = item.available <= 0 && item.held > 0;
            const isLowStock = item.available > 0 && item.available <= 2;

            return (
              <tr key={item.productId} className="hover:bg-[#FAF8F5]/80 transition-colors">
                <td className="px-4 py-3 font-bold text-[#0E2A22]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#276350]" aria-hidden="true" />
                    <span>{item.productId}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-[#181614]">
                  {item.stockOnHand}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {item.held > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80">
                      🔒 {item.held}
                    </span>
                  ) : (
                    <span className="text-[#A8A29E]">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold">
                  <span
                    className={
                      item.available > 0
                        ? 'text-emerald-700 font-black'
                        : 'text-red-600 font-black'
                    }
                  >
                    {item.available}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-block px-2 py-0.5 bg-[#FAF8F5] border border-[#E3DDD2] rounded text-[11px] text-[#57534E]">
                    v{item.inventoryVersion}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {isHeldLock ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      Locked Online
                    </span>
                  ) : isOutOfStock ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                      Out of Stock
                    </span>
                  ) : isLowStock ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Low Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Available
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
