'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { RecoveryResult, ProductOffer, RecoveryConstraints } from '@/contracts';
import { api } from '@/lib/api-client';
import { useStore } from '@/lib/session/store-context';
import { AlternativeCard } from './alternative-card';
import { ConstraintEditor } from './constraint-editor';
import { Alert } from '../feedback/alert';

interface ConflictRecoveryPanelProps {
  storeId: string;
  unavailableProductIds: string[];
  onReplacementApproved: () => void;
  onKeepCartWithoutUnavailable: () => void;
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
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [interestRecorded, setInterestRecorded] = useState<boolean>(false);

  const unavailableId = unavailableProductIds[0];
  const unavailableCartLine = cart?.lines.find((l) => l.productId === unavailableId);

  const fetchAlternatives = useCallback(
    async (customConstraints?: Partial<RecoveryConstraints>, text?: string) => {
      if (!unavailableId) return;
      try {
        const result = await api.getRecovery({
          storeId,
          unavailableProductId: unavailableId,
          text,
          explicitConstraints: customConstraints,
        });
        setRecoveryResult(result);
      } catch (err) {
        console.error('Failed to fetch recovery alternatives:', err);
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
      } catch (err) {
        console.error('Failed to fetch recovery alternatives:', err);
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
      const qty = unavailableCartLine?.quantity ?? 1;

      const remainingLines = cart.lines
        .filter((l) => l.productId !== unavailableId)
        .map((l) => ({ productId: l.productId, quantity: l.quantity }));

      remainingLines.push({ productId: replacement.productId, quantity: qty });

      await api.updateCart(storeId, remainingLines);
      onReplacementApproved();
    } catch (err) {
      console.error('Failed to approve replacement:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleSaveInterest = async () => {
    if (!unavailableId) return;
    try {
      await api.saveInterest(storeId, unavailableId);
      setInterestRecorded(true);
    } catch (err) {
      console.error('Failed to save stock interest:', err);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-md text-stone-900 animate-in fade-in">
      <div className="pb-4 border-b border-stone-200 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl select-none">⚡</span>
          <h2 className="text-xl sm:text-2xl font-black text-stone-900">
            ZeroDeadEnd: Stock Conflict Detected
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-stone-600">
          The counter POS or another shopper just secured the remaining unit of{' '}
          <strong className="text-stone-900 font-semibold">
            {unavailableCartLine?.name ?? unavailableId}
          </strong>
          .
        </p>
      </div>

      <Alert type="info" className="mb-6">
        <strong>Your other cart lines remain intact!</strong> SmartTijori preserves your shopping goal. You can choose a verified alternative from your store, adjust constraints, or continue without this item.
      </Alert>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-extrabold text-lg text-stone-900">
              Verified In-Stock Replacements
            </h3>
            <span className="text-xs text-stone-500">
              Mode:{' '}
              <span className="font-mono font-bold text-emerald-800 uppercase">
                {recoveryResult?.mode ?? 'rules'}
              </span>{' '}
              · Up to 3 factual suggestions from {storeId}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-stone-500 animate-pulse text-sm">
            Retrieving current branch facts and evaluating candidate replacements…
          </div>
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
              {interestRecorded ? '✓ Stock Interest Recorded' : 'Save Demand / Notify When Restocked'}
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
            onApply={(updated, text) => {
              setIsLoading(true);
              fetchAlternatives(updated, text);
            }}
            onSaveInterest={handleSaveInterest}
            isLoading={isLoading}
          />
        </div>
      )}

      <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={onKeepCartWithoutUnavailable}
          className="text-xs sm:text-sm font-semibold text-stone-600 hover:text-stone-900 underline"
        >
          Remove unavailable item and proceed with remaining items →
        </button>
      </div>
    </div>
  );
}
