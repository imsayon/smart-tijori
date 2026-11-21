'use client';

import React, { useState } from 'react';
import type { RecoveryConstraints } from '@/contracts';

interface ConstraintEditorProps {
  constraints: RecoveryConstraints;
  onApply: (updated: RecoveryConstraints, customText?: string) => void;
  onSaveInterest: () => void;
  isLoading?: boolean;
}

export function ConstraintEditor({
  constraints,
  onApply,
  onSaveInterest,
  isLoading,
}: ConstraintEditorProps) {
  const [maxPriceRupees, setMaxPriceRupees] = useState<string>(
    constraints.maxPricePaise ? (constraints.maxPricePaise / 100).toString() : '300'
  );
  const [customText, setCustomText] = useState('');
  const [interestSaved, setInterestSaved] = useState(false);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const maxPaise = parseFloat(maxPriceRupees) ? Math.round(parseFloat(maxPriceRupees) * 100) : undefined;
    onApply(
      {
        ...constraints,
        maxPricePaise: maxPaise,
      },
      customText.trim() || undefined
    );
  };

  const handleInterest = () => {
    setInterestSaved(true);
    onSaveInterest();
  };

  return (
    <div className="bg-[#FAF8F5] border border-[#E3DDD2] rounded-3xl p-5 sm:p-6 text-[#181614] text-sm shadow-xs">
      <h4 className="font-black text-base text-[#0E2A22] mb-1.5 flex items-center gap-2 tracking-tight">
        <span>⚙️ Refine Search Constraints</span>
      </h4>
      <p className="text-xs text-[#78716C] mb-4 leading-relaxed">
        Adjust your budget, specifications, or describe what you need in plain text.
      </p>

      <form onSubmit={handleUpdate} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-[#181614] mb-1">
              Purpose / Category:
            </label>
            <span className="font-mono bg-white px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] block text-[#0E2A22] font-semibold">
              {constraints.purpose}
            </span>
          </div>

          <div>
            <label className="block font-bold text-[#181614] mb-1">
              Max Budget (₹):
            </label>
            <input
              type="number"
              min="10"
              max="2000"
              value={maxPriceRupees}
              onChange={(e) => setMaxPriceRupees(e.target.value)}
              className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] font-bold text-[#181614] focus:ring-2 focus:ring-[#0E2A22]"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-[#181614] mb-1 text-xs">
            Describe specific needs (e.g. &quot;1L liquid detergent front-load under ₹300&quot;):
          </label>
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Type your preferences…"
            className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] text-xs text-[#181614] focus:ring-2 focus:ring-[#0E2A22]"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto bg-[#0E2A22] hover:bg-[#163D31] text-[#FAF8F5] font-black text-xs px-6 py-3 rounded-full transition-all shadow-sm disabled:opacity-50 cursor-pointer border border-[#276350]/60"
          >
            {isLoading ? 'Re-evaluating…' : 'Find Matching Alternatives →'}
          </button>

          <button
            type="button"
            onClick={handleInterest}
            disabled={interestSaved}
            className="text-xs text-[#78716C] hover:text-[#181614] underline font-medium cursor-pointer"
          >
            {interestSaved ? '✓ Stock interest recorded' : 'Save stock interest for later notification'}
          </button>
        </div>
      </form>
    </div>
  );
}
