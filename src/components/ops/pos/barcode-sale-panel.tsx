'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PosSaleOutcome } from '@/contracts';
import { formatPaise } from '@/lib/utils/currency';
import { resolveBarcodeToProductId, BARCODE_CATALOG } from '@/lib/pos/barcode-mapper';

interface BarcodeSalePanelProps {
  storeId?: string;
  operatorId?: string;
}

export function BarcodeSalePanel({
  storeId = 'blr-01',
  operatorId = 'staff01',
}: BarcodeSalePanelProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentSales, setRecentSales] = useState<Array<Extract<PosSaleOutcome, { ok: true }>>>([]);
  const [lastConflict, setLastConflict] = useState<Extract<PosSaleOutcome, { ok: false }> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount and after submission for continuous scanner streams
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAuthorizeSale = useCallback(
    async (codeToScan: string) => {
      const cleanCode = codeToScan.trim();
      if (!cleanCode) return;

      setIsSubmitting(true);
      setErrorMessage(null);
      setLastConflict(null);

      // Generate POS idempotency key
      const operationKey = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      try {
        const response = await fetch('/api/pos/sale', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': operationKey,
            // Uses current operator session cookie or demo header
            Authorization: `Bearer ops_${operatorId}_${storeId}`,
          },
          body: JSON.stringify({
            storeId,
            barcode: cleanCode,
            quantity,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const conflictData: Extract<PosSaleOutcome, { ok: false }> = {
            ok: false,
            code: data.error?.code || 'STOCK_UNAVAILABLE',
            message: data.error?.message || 'Sale authorization failed',
            details: data.error?.details,
            source: 'FIXTURE_SIMULATED',
          };
          setLastConflict(conflictData);
          return;
        }

        const confirmedSale = data.sale as Extract<PosSaleOutcome, { ok: true }>;
        setRecentSales((prev) => [confirmedSale, ...prev.slice(0, 9)]);
        setBarcodeInput('');
        setQuantity(1);
      } catch {
        setErrorMessage('Failed to connect to store inventory authority. Please re-scan.');
      } finally {
        setIsSubmitting(false);
        // Re-focus scanner field
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [storeId, operatorId, quantity]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim() || isSubmitting) return;
    void handleAuthorizeSale(barcodeInput);
  };

  const previewProductId = resolveBarcodeToProductId(barcodeInput);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header & Mode Notice */}
      <div className="bg-gradient-to-r from-[#0E2A22] to-[#163D31] text-[#FAF8F5] p-6 rounded-3xl border border-[#276350] shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🏪</span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Participating POS Checkout Gate</h1>
          </div>
          <p className="text-xs text-[#E8F3EE]/80">
            Connected Cashier Terminal · Branch <span className="font-mono font-bold text-[#F59E0B]">{storeId}</span> · Operator <span className="font-mono font-bold">{operatorId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-amber-500/20 text-amber-300 font-mono font-bold px-3 py-1.5 rounded-full border border-amber-500/40">
            ⚡ [SIMULATED FIXTURE GATE]
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Scanner Input Panel */}
        <div className="md:col-span-2 space-y-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl border border-[#E3DDD2] p-6 shadow-sm space-y-5"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="pos-barcode-input" className="text-xs font-black uppercase tracking-wider text-[#57534E]">
                  Barcode Scanner Input (EAN-13 / UPC / SKU)
                </label>
                <span className="text-[11px] text-[#78716C]">
                  Scanner sends Enter automatically
                </span>
              </div>
              <div className="relative">
                <input
                  id="pos-barcode-input"
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan item barcode or enter SKU…"
                  disabled={isSubmitting}
                  className="w-full bg-[#FAF8F5] border-2 border-[#163D31] focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 text-[#181614] font-mono text-lg font-bold px-4 py-3.5 rounded-2xl outline-hidden transition-all"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !barcodeInput.trim()}
                  className="absolute right-2 top-2 bottom-2 bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] font-black text-xs px-5 rounded-xl transition-all disabled:opacity-40 cursor-pointer shadow-xs active:scale-95"
                >
                  {isSubmitting ? 'Verifying…' : 'Authorize Sale ↵'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label htmlFor="pos-quantity-input" className="text-xs font-black uppercase tracking-wider text-[#57534E] block mb-1">
                  Quantity
                </label>
                <input
                  id="pos-quantity-input"
                  type="number"
                  min={1}
                  max={50}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 bg-[#FAF8F5] border border-[#E3DDD2] text-[#181614] font-mono font-bold text-center py-2 rounded-xl"
                />
              </div>

              {previewProductId && (
                <div className="flex-2 bg-[#F7F4EE] border border-[#E3DDD2] p-2.5 rounded-xl text-xs text-[#57534E]">
                  <span className="text-[#78716C] block text-[10px] uppercase font-bold">Catalog Match:</span>
                  <span className="font-mono font-bold text-[#0E2A22]">{previewProductId}</span>
                </div>
              )}
            </div>

            {/* Quick Test Barcode Buttons for manual evaluation */}
            <div className="border-t border-[#E3DDD2] pt-4">
              <span className="text-[11px] font-bold text-[#78716C] block mb-2">
                Quick Test Sample Barcodes:
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(BARCODE_CATALOG).slice(0, 4).map(([code, pid]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setBarcodeInput(code);
                      void handleAuthorizeSale(code);
                    }}
                    className="text-[11px] bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#E3DDD2] px-2.5 py-1 rounded-lg text-[#57534E] font-mono transition-all cursor-pointer"
                  >
                    {pid} ({code})
                  </button>
                ))}
              </div>
            </div>
          </form>

          {/* Conflict & Error Alerts */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs leading-relaxed">
              ⚠️ <span className="font-bold">System Error:</span> {errorMessage}
            </div>
          )}

          {lastConflict && (
            <div
              className={`p-5 rounded-3xl border shadow-sm ${
                lastConflict.code === 'STOCK_LOCKED_ONLINE'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">
                  {lastConflict.code === 'STOCK_LOCKED_ONLINE' ? '🔒' : '❌'}
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/10 font-mono">
                      {lastConflict.code}
                    </span>
                    <span className="text-xs text-stone-500">Authoritative Rejection</span>
                  </div>
                  <p className="text-sm font-bold leading-snug">{lastConflict.message}</p>

                  {lastConflict.details?.activeHoldExpiresAt && (
                    <p className="text-xs text-amber-800 pt-1">
                      Online reservation expires at:{' '}
                      <span className="font-mono font-bold">
                        {new Date(lastConflict.details.activeHoldExpiresAt).toLocaleTimeString()}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Confirmed Sales Sidebar */}
        <div className="bg-[#FAF8F5] rounded-3xl border border-[#E3DDD2] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E3DDD2]">
            <h2 className="text-sm font-black text-[#181614] tracking-tight">Recent POS Sales</h2>
            <span className="text-[10px] font-mono bg-[#E8F3EE] text-[#276350] px-2 py-0.5 rounded-md font-bold">
              {recentSales.length} confirmed
            </span>
          </div>

          {recentSales.length === 0 ? (
            <p className="text-xs text-[#78716C] text-center py-8">
              No sales authorized yet in this session. Scan a barcode to authorize.
            </p>
          ) : (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div
                  key={sale.saleId}
                  className="bg-white p-3.5 rounded-2xl border border-[#E3DDD2] shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-[#0E2A22]">{sale.productName}</span>
                    <span className="font-mono font-bold text-[#181614]">{formatPaise(sale.totalPaise)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#78716C]">
                    <span>Qty: {sale.quantity}</span>
                    <span className="font-mono text-[10px] text-[#276350]">✓ Confirmed</span>
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono">
                    ID: {sale.saleId} · v{sale.inventoryVersion}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
