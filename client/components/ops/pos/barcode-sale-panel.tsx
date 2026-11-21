'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { formatPaise } from '@/lib/utils/currency';
import { resolveBarcodeToProductId, resolveBarcodeToSend, BARCODE_CATALOG } from '@/lib/pos/barcode-mapper';

export interface PosConfirmedLine {
  productId: string;
  name: string;
  quantity: number;
  unitPricePaise: number;
  inventoryVersion?: number;
}

export interface PosConfirmedSale {
  saleId: string;
  storeId: string;
  status: 'CONFIRMED';
  source?: string;
  soldAt: string;
  lines: PosConfirmedLine[];
  totalPaise: number;
}

export interface PosConflictState {
  code: string;
  message: string;
  productIds?: string[];
  activeHoldExpiresAt?: string;
}

export interface BarcodeSalePanelProps {
  storeId?: string;
  operatorId?: string;
  fixture?: boolean;
}

export function BarcodeSalePanel({
  storeId = 'blr-01',
  operatorId = 'staff01',
  fixture = false,
}: BarcodeSalePanelProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentSales, setRecentSales] = useState<PosConfirmedSale[]>([]);
  const [lastConflict, setLastConflict] = useState<PosConflictState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const pendingStorageKey = `smart-tijori:pos:pending:${fixture ? 'fixture' : 'live'}:${storeId}:${operatorId}`;

  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const attempt = useRef<{ barcode: string; quantity: number; key: string } | null>(null);

  // Restore an unresolved transaction before accepting a new scan. Storage is
  // scoped to this browser tab, verified operator and branch; no auth secret is stored.
  useEffect(() => {
    let cancelled = false;
    // Restore from browser storage asynchronously, and block submissions until
    // the recovery check completes so a new scan cannot overtake an old one.
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = window.sessionStorage.getItem(pendingStorageKey);
        if (!saved) return;
        const parsed: unknown = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object' ||
            !('barcode' in parsed) || typeof parsed.barcode !== 'string' || !parsed.barcode ||
            !('quantity' in parsed) || !Number.isInteger(parsed.quantity) ||
            (parsed.quantity as number) < 1 ||
            !('key' in parsed) || typeof parsed.key !== 'string' || !parsed.key) {
          throw new Error('Invalid unresolved transaction record');
        }
        const previous = parsed as { barcode: string; quantity: number; key: string };
        attempt.current = previous;
        setBarcodeInput(previous.barcode);
        setQuantity(previous.quantity);
        setErrorMessage('An earlier sale may have committed. Retry this barcode and quantity to recover its receipt.');
      } catch {
        setRecoveryBlocked(true);
        setErrorMessage('Sale recovery storage is unavailable or invalid. Stop checkout and reconcile the previous transaction.');
      } finally {
        setRecoveryReady(true);
      }
    });
    return () => { cancelled = true; };
  }, [pendingStorageKey]);

  // Auto-focus input on mount for continuous scanner streams
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAuthorizeSale = useCallback(
    async (codeToScan: string) => {
      const cleanCode = codeToScan.trim();
      if (!cleanCode || inFlight.current || !recoveryReady || recoveryBlocked) return;
      const barcode = resolveBarcodeToSend(cleanCode);
      const previous = attempt.current;
      if (previous && (previous.barcode !== barcode || previous.quantity !== quantity)) {
        setErrorMessage('Resolve the previous sale by retrying the same barcode and quantity first.');
        return;
      }
      const operationKey = previous?.key ?? crypto.randomUUID();
      const pending = { barcode, quantity, key: operationKey };
      // Persist before sending: a committed sale can lose its HTTP response or
      // outlive this React component during navigation or refresh.
      try {
        window.sessionStorage.setItem(pendingStorageKey, JSON.stringify(pending));
      } catch {
        setRecoveryBlocked(true);
        setErrorMessage('Cannot persist sale recovery state. Checkout stopped to prevent a duplicate sale.');
        return;
      }
      attempt.current = pending;
      inFlight.current = true;
      setIsSubmitting(true);
      setErrorMessage(null);
      setLastConflict(null);

      try {
        const response = await fetch('/api/pos/sale', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': operationKey,
            ...(fixture ? { Authorization: `Bearer ops_${operatorId}_${storeId}` } : {}),
          },
          body: JSON.stringify({
            storeId,
            barcode,
            quantity,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status < 500) {
            attempt.current = null;
            try { window.sessionStorage.removeItem(pendingStorageKey); }
            catch { setRecoveryBlocked(true); }
          }
          const errCode = data.error?.code || 'VALIDATION_ERROR';
          const errMsg = data.error?.message || 'Sale authorization rejected';
          setLastConflict({
            code: errCode,
            message: errMsg,
            productIds: data.error?.productIds,
            activeHoldExpiresAt: data.error?.details?.activeHoldExpiresAt,
          });
          return;
        }

        if (data.sale) {
          attempt.current = null;
          try { window.sessionStorage.removeItem(pendingStorageKey); }
          catch { setRecoveryBlocked(true); }
          const confirmed = data.sale as PosConfirmedSale;
          setRecentSales((prev) => [confirmed, ...prev.slice(0, 9)]);
          setBarcodeInput('');
          setQuantity(1);
        }
      } catch {
        setErrorMessage('Sale outcome is unknown. Retry the same barcode and quantity.');
      } finally {
        inFlight.current = false;
        setIsSubmitting(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [storeId, operatorId, fixture, quantity, pendingStorageKey, recoveryReady, recoveryBlocked]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim() || isSubmitting || !recoveryReady || recoveryBlocked) return;
    void handleAuthorizeSale(barcodeInput);
  };

  const previewProductId = fixture ? resolveBarcodeToProductId(barcodeInput) : null;

  return (
    <div className="atelier-pos space-y-6">
      {/* Header & Server-Verified Authority Notice */}
      <div className="bg-gradient-to-r from-[#0E2A22] to-[#163D31] text-[#FAF8F5] p-6 rounded-3xl border border-[#276350] shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🏪</span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Participating POS Checkout Gate</h1>
          </div>
          <p className="text-xs text-[#E8F3EE]/80">
            Connected Cashier Terminal · Branch <span className="font-mono font-bold text-[#F59E0B]">{storeId}</span> (Server-Verified) · Operator <span className="font-mono font-bold">{operatorId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Label runtime adapter transparently */}
          <span className="text-xs bg-amber-500/20 text-amber-300 font-mono font-bold px-3 py-1.5 rounded-full border border-amber-500/40">
            {fixture ? '⚡ [SIMULATED FIXTURE GATE]' : 'PostgreSQL checkout gate'}
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
                  Barcode Scanner Stream / SKU Input
                </label>
                <span className="text-[11px] text-[#78716C]">
                  Auto-submits on Enter (Hardware Scanner Compatible)
                </span>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="pos-barcode-input"
                    ref={inputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scan item barcode or enter SKU (e.g. ST:tea-250)..."
                    disabled={isSubmitting}
                    className="w-full bg-[#FAF8F5] border-2 border-[#E3DDD2] focus:border-[#276350] focus:bg-white rounded-2xl px-4 py-3 text-sm font-mono text-[#181614] placeholder:text-[#A8A29E] focus:outline-none transition-all shadow-inner"
                    autoComplete="off"
                    autoFocus
                  />
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setBarcodeInput('');
                        inputRef.current?.focus();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="w-24">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    disabled={isSubmitting}
                    className="w-full bg-[#FAF8F5] border-2 border-[#E3DDD2] focus:border-[#276350] focus:bg-white rounded-2xl px-3 py-3 text-sm font-mono text-center text-[#181614] focus:outline-none shadow-inner"
                    title="Quantity"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!barcodeInput.trim() || isSubmitting || !recoveryReady || recoveryBlocked}
                  className="bg-[#276350] hover:bg-[#1E4D3E] disabled:bg-[#A8A29E] text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 disabled:pointer-events-none"
                >
                  {isSubmitting ? 'Verifying...' : 'Authorize'}
                </button>
              </div>

              {previewProductId && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-[#276350]">
                  <span className="text-[10px] uppercase font-bold">Catalog Match:</span>
                  <span className="font-mono font-bold text-[#0E2A22]">{previewProductId}</span>
                </div>
              )}
            </div>

            {/* Quick Test Barcode Buttons for Cashier Evaluation */}
            {fixture && <div className="border-t border-[#E3DDD2] pt-4">
              <span className="text-[11px] font-bold text-[#78716C] block mb-2">
                Load an example barcode
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(BARCODE_CATALOG)
                  .filter(([code]) => code.startsWith('ST:'))
                  .slice(0, 4)
                  .map(([code, item]) => (
                    <button
                      key={code}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setBarcodeInput(code);
                        inputRef.current?.focus();
                      }}
                      className="text-[11px] bg-[#FAF8F5] hover:bg-[#F3EFEA] border border-[#E3DDD2] px-2.5 py-1 rounded-lg text-[#57534E] font-mono transition-all cursor-pointer"
                    >
                      {item.name} ({code})
                    </button>
                  ))}
              </div>
            </div>}
          </form>

          {/* Conflict & Error Alerts */}
          {errorMessage && (
            <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs leading-relaxed">
              ⚠️ <span className="font-bold">System Error:</span> {errorMessage}
            </div>
          )}

          {lastConflict && (
            <div role="alert"
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

                  {lastConflict.code === 'STOCK_LOCKED_ONLINE' && (
                    <p className="text-xs text-amber-800 pt-1">
                      This unit is actively held by an online checkout reservation (59s countdown). Sale blocked by CartLock to prevent double allocation.
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
              {recentSales.map((sale) => {
                const line = sale.lines[0];
                return (
                  <div
                    key={sale.saleId}
                    className="bg-white p-3.5 rounded-2xl border border-[#E3DDD2] shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-[#0E2A22]">{line?.name || 'Item'}</span>
                      <span className="font-mono font-bold text-[#181614]">{formatPaise(sale.totalPaise)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#78716C]">
                      <span>Qty: {line?.quantity || 1}</span>
                      <span className="font-mono text-[10px] text-[#276350]">✓ Confirmed</span>
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono">
                      ID: {sale.saleId} · {sale.source || 'simulated'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
