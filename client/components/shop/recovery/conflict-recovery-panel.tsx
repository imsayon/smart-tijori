'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
  const [recoveryResult, setRecoveryResult] = useState<RecoveryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [failed, setFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [interestRecorded, setInterestRecorded] = useState<boolean>(false);

  const unavailableId = unavailableProductIds[0];
  const unavailableCartLine = cart?.lines.find((l) => l.productId === unavailableId);

  const fetchAlternatives = useCallback(
    async (customConstraints?: Partial<RecoveryConstraints>) => {
      if (!unavailableId) return;
      setFailed(false);
      try {
        const result = await api.getRecovery({
          storeId,
          unavailableProductId: unavailableId,
          explicitConstraints: customConstraints,
        });
        setRecoveryResult(result);
      } catch {
        setFailed(true);
      } finally {
        setIsLoading(false);
      }
    },
    [storeId, unavailableId]
  );

  useEffect(() => {
    let active = true;
    async function init() {
      if (!unavailableId) return;
      try {
        const result = await api.getRecovery({
          storeId,
          unavailableProductId: unavailableId,
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

    init();
    return () => {
      active = false;
    };
  }, [storeId, unavailableId]);

  const handleApproveReplacement = async (replacement: ProductOffer) => {
    if (!cart || !unavailableId) return;
    try {
      setIsApproving(true);
      setActionError(null);
      const qty = unavailableCartLine?.quantity ?? 1;

      const remainingLines = cart.lines
        .filter((l) => l.productId !== unavailableId)
        .map((l) => ({ productId: l.productId, quantity: l.quantity }));

      const existing = remainingLines.find(line => line.productId === replacement.productId);
      if (existing) existing.quantity += qty;
      else remainingLines.push({ productId: replacement.productId, quantity: qty });

      const updated = await api.updateCart(storeId, remainingLines);
      await onReplacementApproved(updated);
    } catch {
      setActionError('Could not update your cart. Please try again.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleSaveInterest = async () => {
    if (!unavailableId) return;
    try {
      await api.saveInterest(storeId, unavailableId);
      setInterestRecorded(true);
    } catch {
      setActionError('Could not save restock interest. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-md text-stone-900 animate-in fade-in">
      <div className="pb-4 border-b border-stone-200 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl select-none">⚡</span>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900">
            This item just became unavailable
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-stone-600">
          Your branch can no longer reserve{' '}
          <strong className="text-stone-900 font-semibold">
            {unavailableCartLine?.name ?? unavailableId}
          </strong>
          .
        </p>
      </div>

      <Alert type="info" className="mb-6">
        Your other cart items are still here. Choose a replacement or continue without this item.
      </Alert>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-extrabold text-lg text-stone-900">
              In-stock alternatives
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
            <button type="button" className="underline" onClick={() => {
              setIsLoading(true);
              void fetchAlternatives();
            }}>Try again</button>
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
            constraints={recoveryResult.constraints}
            onApply={(updated) => {
              setIsLoading(true);
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
          Remove unavailable item and proceed with remaining items →
        </button>
      </div>
    </div>
  );
}
