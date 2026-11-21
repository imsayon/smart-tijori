'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { Cart, RecoveryResult, ProductOffer, RecoveryConstraints } from '@/contracts';
import { api } from '@/lib/api-client';
import { useStore } from '@/lib/session/store-context';
import { AlternativeCard } from './alternative-card';
import { ConstraintEditor } from './constraint-editor';
import { Alert } from '../feedback/alert';

interface ConflictRecoveryPanelProps {
  storeId: string;
  unavailableProductIds: string[];
  onReplacementApproved: (cart: Cart) => Promise<void>;
  onKeepCartWithoutUnavailable: () => Promise<void>;
}

export function ConflictRecoveryPanel({
  storeId,
  unavailableProductIds,
  onReplacementApproved,
  onKeepCartWithoutUnavailable,
}: ConflictRecoveryPanelProps) {
  const { cart } = useStore();
  const [pendingUnavailableIds, setPendingUnavailableIds] = useState<string[]>(unavailableProductIds);
  const [activeUnavailableId, setActiveUnavailableId] = useState<string>(() => unavailableProductIds[0] ?? '');
  const [recoveryResult, setRecoveryResult] = useState<RecoveryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [failed, setFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [interestRecorded, setInterestRecorded] = useState<boolean>(false);

  const [prevUnavailableProductIds, setPrevUnavailableProductIds] = useState<string[]>(unavailableProductIds);

  // Adjust state during render when props change per React guidelines
  if (prevUnavailableProductIds !== unavailableProductIds) {
    setPrevUnavailableProductIds(unavailableProductIds);
    setPendingUnavailableIds(unavailableProductIds);
    if (!unavailableProductIds.includes(activeUnavailableId)) {
      setActiveUnavailableId(unavailableProductIds[0] ?? '');
      setRecoveryResult(null);
    }
  }

  const activeCartLine = useMemo(() => {
    return cart?.lines.find((l) => l.productId === activeUnavailableId);
  }, [cart, activeUnavailableId]);

  // Resolve the original unavailable offer for price comparison
  const unavailableOfferForCard: ProductOffer | null = useMemo(() => {
    // 1. Prefer recovery response unavailableOffer if available and matching active item
    const fromRecovery = (recoveryResult as { unavailableOffer?: ProductOffer } | null)?.unavailableOffer;
    if (
      fromRecovery &&
      fromRecovery.productId === activeUnavailableId &&
      typeof fromRecovery.pricePaise === 'number' &&
      Number.isFinite(fromRecovery.pricePaise)
    ) {
      return fromRecovery;
    }

    // 2. Derive from active cart line if price is present and finite
    if (
      activeCartLine &&
      typeof activeCartLine.unitPricePaise === 'number' &&
      Number.isFinite(activeCartLine.unitPricePaise)
    ) {
      return {
        productId: activeCartLine.productId,
        storeId,
        city: 'Bengaluru',
        name: activeCartLine.name,
        category: 'pantry',
        purpose: 'general',
        pricePaise: activeCartLine.unitPricePaise,
        imageUrl: '',
        pack: { quantity: 1, unit: 'count' },
        attributes: {},
        available: 0,
        inventoryVersion: 1,
        checkedAt: new Date().toISOString(),
      };
    }

    return null;
  }, [recoveryResult, activeUnavailableId, activeCartLine, storeId]);

  const fetchAlternatives = useCallback(
    async (customConstraints?: Partial<RecoveryConstraints>) => {
      if (!activeUnavailableId) return;
      setFailed(false);
      setIsLoading(true);
      try {
        const result = await api.getRecovery({
          storeId,
          unavailableProductId: activeUnavailableId,
          explicitConstraints: customConstraints,
        });
        setRecoveryResult(result);
      } catch {
        setFailed(true);
      } finally {
        setIsLoading(false);
      }
    },
    [storeId, activeUnavailableId]
  );

  useEffect(() => {
    let active = true;
    async function init() {
      if (!activeUnavailableId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setFailed(false);
      setInterestRecorded(false);
      try {
        const result = await api.getRecovery({
          storeId,
          unavailableProductId: activeUnavailableId,
        });
        if (active) {
          setRecoveryResult(result);
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void init();
    return () => {
      active = false;
    };
  }, [storeId, activeUnavailableId]);

  // Resolves a single conflict with an approved alternative while preserving all other items
  const handleApproveReplacement = async (replacement: ProductOffer) => {
    if (!cart || !activeUnavailableId) return;
    try {
      setIsApproving(true);
      setActionError(null);
      const qty = activeCartLine?.quantity ?? 1;

      // Preserve all other items (both other conflicting items and unaffected items)
      const remainingLines = cart.lines
        .filter((l) => l.productId !== activeUnavailableId)
        .map((l) => ({ productId: l.productId, quantity: l.quantity }));

      const existing = remainingLines.find((line) => line.productId === replacement.productId);
      if (existing) {
        existing.quantity += qty;
      } else {
        remainingLines.push({ productId: replacement.productId, quantity: qty });
      }

      const updated = await api.updateCart(storeId, remainingLines);
      const nextPending = pendingUnavailableIds.filter((id) => id !== activeUnavailableId);
      setPendingUnavailableIds(nextPending);

      if (nextPending.length === 0) {
        // All conflicts resolved!
        await onReplacementApproved(updated);
      } else {
        // More conflicts remain to be resolved
        setRecoveryResult(null);
        setActiveUnavailableId(nextPending[0]);
      }
    } catch {
      setActionError('Could not update your cart. Please try again.');
    } finally {
      setIsApproving(false);
    }
  };

  // Explicitly removes only one unavailable item, preserving other conflicting and unaffected items
  const handleRemoveSingleUnavailable = async (productIdToRemove: string) => {
    if (!cart) return;
    try {
      setIsApproving(true);
      setActionError(null);

      // Preserve all lines except the explicitly removed product
      const remainingLines = cart.lines
        .filter((l) => l.productId !== productIdToRemove)
        .map((l) => ({ productId: l.productId, quantity: l.quantity }));

      const updated = await api.updateCart(storeId, remainingLines);
      const nextPending = pendingUnavailableIds.filter((id) => id !== productIdToRemove);
      setPendingUnavailableIds(nextPending);

      if (nextPending.length === 0) {
        // All conflicts resolved!
        await onReplacementApproved(updated);
      } else {
        if (activeUnavailableId === productIdToRemove) {
          setRecoveryResult(null);
          setActiveUnavailableId(nextPending[0]);
        }
      }
    } catch {
      setActionError('Could not update your cart. Please try again.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleSaveInterest = async () => {
    if (!activeUnavailableId) return;
    try {
      await api.saveInterest(storeId, activeUnavailableId);
      setInterestRecorded(true);
    } catch {
      setActionError('Could not save restock interest. Please try again.');
    }
  };

  // Safe fallback if zero unavailable products were provided
  if (pendingUnavailableIds.length === 0 && unavailableProductIds.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-md text-stone-900">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl select-none">✓</span>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900">No stock conflicts</h2>
        </div>
        <p className="text-xs sm:text-sm text-stone-600 mb-6">
          No unavailable items found in your checkout hold. You can proceed with your order.
        </p>
        <button
          type="button"
          onClick={() => {
            if (cart) void onReplacementApproved(cart);
          }}
          className="bg-[#173F35] text-white font-bold py-3 px-6 rounded-xl hover:bg-[#275546] transition-colors"
        >
          Continue to Checkout →
        </button>
      </div>
    );
  }

  const isMultiple = pendingUnavailableIds.length > 1;

  return (
    <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-md text-stone-900 animate-in fade-in">
      <div className="pb-4 border-b border-stone-200 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl select-none">⚡</span>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900">
            {isMultiple ? 'Items in your cart became unavailable' : 'This item just became unavailable'}
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-stone-600">
          {isMultiple ? (
            <>
              Your branch can no longer reserve{' '}
              <strong className="text-stone-900 font-semibold">{pendingUnavailableIds.length} items</strong>.
              Please resolve each item below.
            </>
          ) : (
            <>
              Your branch can no longer reserve{' '}
              <strong className="text-stone-900 font-semibold">
                {activeCartLine?.name ?? activeUnavailableId}
              </strong>
              .
            </>
          )}
        </p>
      </div>

      <Alert type="info" className="mb-6">
        Your other cart items are still here. Choose a replacement or continue without this item.
      </Alert>

      {/* Multiple unavailable products list: Shopper is informed of EVERY conflicting item */}
      {isMultiple && (
        <div className="mb-6 bg-stone-50 border border-stone-200 rounded-2xl p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
            Unavailable Items Requiring Resolution ({pendingUnavailableIds.length})
          </div>
          <div className="space-y-2">
            {pendingUnavailableIds.map((id) => {
              const line = cart?.lines.find((l) => l.productId === id);
              const isActive = id === activeUnavailableId;
              return (
                <div
                  key={id}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl border transition-colors gap-2 ${
                    isActive
                      ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base select-none">⚠️</span>
                    <div>
                      <span className="font-bold text-sm text-stone-900">
                        {line?.name ?? id}
                      </span>
                      {line && (
                        <span className="text-xs text-stone-500 ml-2">
                          (Qty: {line.quantity})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveUnavailableId(id);
                        setRecoveryResult(null);
                      }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-amber-600 text-white'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {isActive ? 'Reviewing Alternatives' : 'Select to Replace'}
                    </button>
                    <button
                      type="button"
                      disabled={isApproving}
                      onClick={() => void handleRemoveSingleUnavailable(id)}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 hover:underline px-2 py-1.5"
                    >
                      Remove from cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-extrabold text-lg text-stone-900">
              In-stock alternatives
              {isMultiple && activeCartLine && (
                <span className="font-normal text-sm text-stone-600 ml-2">
                  for <strong className="font-semibold text-stone-800">{activeCartLine.name}</strong>
                </span>
              )}
            </h3>
            {recoveryResult?.mode === 'rules' && (
              <p className="text-xs text-stone-500">Matched by product, pack size and price.</p>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-stone-500 motion-safe:animate-pulse text-sm">
            Checking branch stock…
          </div>
        ) : failed ? (
          <Alert type="error">
            Could not load alternatives.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => {
                void fetchAlternatives();
              }}
            >
              Try again
            </button>
          </Alert>
        ) : !recoveryResult || recoveryResult.candidates.length === 0 ? (
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-stone-600 font-medium mb-3">
              No exact match found satisfying all hard constraints at this branch.
            </p>
            <button
              type="button"
              onClick={handleSaveInterest}
              disabled={interestRecorded}
              className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl transition-colors"
            >
              {interestRecorded ? '✓ Stock Interest Recorded' : 'Save restock interest'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recoveryResult.candidates.map((cand) => (
              <AlternativeCard
                key={cand.offer.productId}
                candidate={cand}
                unavailableOffer={unavailableOfferForCard}
                onApprove={handleApproveReplacement}
                isApproving={isApproving}
              />
            ))}
          </div>
        )}
      </div>

      {recoveryResult && (
        <div className="mb-8">
          <ConstraintEditor
            key={activeUnavailableId}
            constraints={recoveryResult.constraints}
            onApply={(updated) => {
              void fetchAlternatives(updated);
            }}
            isLoading={isLoading}
          />
        </div>
      )}

      {actionError && <Alert type="error">{actionError}</Alert>}
      <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          disabled={isApproving}
          onClick={async () => {
            setIsApproving(true);
            setActionError(null);
            try {
              await onKeepCartWithoutUnavailable();
            } catch {
              setActionError('Could not update your cart. Please try again.');
            } finally {
              setIsApproving(false);
            }
          }}
          className="text-xs sm:text-sm font-semibold text-stone-600 hover:text-stone-900 underline"
        >
          {isMultiple
            ? `Remove all unavailable items (${pendingUnavailableIds.length}) and proceed with remaining items →`
            : 'Remove unavailable item and proceed with remaining items →'}
        </button>
      </div>
    </div>
  );
}
