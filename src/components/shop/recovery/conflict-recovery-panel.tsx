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
    <div className="bg-white rounded-3xl border border-[#E3DDD2] p-6 sm:p-9 shadow-xl text-[#181614] animate-in fade-in relative overflow-hidden">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-[#C89B3C] to-amber-600" />

      <div className="pb-5 border-b border-[#F0EBE1] mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl border border-amber-200">
            ⚡
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#181614] tracking-tight">
            ZeroDeadEnd: Stock Conflict Detected
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed">
          The counter POS or another shopper just secured the remaining unit of{' '}
          <strong className="text-[#181614] font-bold">
            {unavailableCartLine?.name ?? unavailableId}
          </strong>
          .
        </p>
      </div>

      <Alert type="info" className="mb-6">
        <strong>Your other cart lines remain intact!</strong> SmartTijori preserves your shopping goal. You can choose a verified alternative from your store, adjust constraints, or continue without this item.
      </Alert>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-black text-lg text-[#181614] tracking-tight">
              Verified In-Stock Replacements
            </h3>
            <span className="text-xs text-[#78716C]">
              Mode:{' '}
              <span className="font-mono font-bold text-[#14382C] uppercase bg-[#EAF4EE] px-2 py-0.5 rounded-md border border-[#B8DEC8]">
                {recoveryResult?.mode ?? 'rules'}
              </span>{' '}
              · Up to 3 factual suggestions from {storeId}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-[#78716C] animate-pulse text-sm">
            Retrieving current branch facts and evaluating candidate replacements…
          </div>
        ) : !recoveryResult || recoveryResult.candidates.length === 0 ? (
          <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-2xl p-7 text-center">
            <p className="text-sm text-[#57534E] font-medium mb-4">
              No exact match found satisfying all hard constraints at this branch.
            </p>
            <button
              type="button"
              onClick={handleSaveInterest}
              disabled={interestRecorded}
              className="text-xs font-black bg-[#C89B3C] hover:bg-[#B3872F] text-[#0E2A22] px-5 py-2.5 rounded-full transition-colors shadow-xs cursor-pointer"
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

      <div className="pt-4 border-t border-[#F0EBE1] flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={onKeepCartWithoutUnavailable}
          className="text-xs sm:text-sm font-bold text-[#78716C] hover:text-[#0E2A22] underline cursor-pointer"
        >
          Remove unavailable item and proceed with remaining items →
        </button>
      </div>
    </div>
  );
}
