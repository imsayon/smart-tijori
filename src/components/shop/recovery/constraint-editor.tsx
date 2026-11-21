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
    <div className="bg-[#F5F1E8] border border-stone-300 rounded-2xl p-5 text-stone-900 text-sm">
      <h4 className="font-bold text-base text-[#173F35] mb-2 flex items-center gap-2">
        <span>⚙️ Refine Search Constraints</span>
      </h4>
      <p className="text-xs text-stone-600 mb-4">
        Adjust your budget, specifications, or describe what you need in plain text.
      </p>

      <form onSubmit={handleUpdate} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Purpose / Category:
            </label>
            <span className="font-mono bg-white px-3 py-2 rounded-lg border border-stone-300 block text-stone-800">
              {constraints.purpose}
            </span>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Max Budget (₹):
            </label>
            <input
              type="number"
              min="10"
              max="2000"
              value={maxPriceRupees}
              onChange={(e) => setMaxPriceRupees(e.target.value)}
              className="w-full bg-white px-3 py-2 rounded-lg border border-stone-300 font-bold text-stone-800 focus:ring-2 focus:ring-[#173F35]"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-stone-700 mb-1 text-xs">
            Describe specific needs (e.g. &quot;1L liquid detergent front-load under ₹300&quot;):
          </label>
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Type your preferences…"
            className="w-full bg-white px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-800 focus:ring-2 focus:ring-[#173F35]"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto bg-[#173F35] hover:bg-[#275546] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Re-evaluating…' : 'Find Matching Alternatives →'}
          </button>

          <button
            type="button"
            onClick={handleInterest}
            disabled={interestSaved}
            className="text-xs text-stone-600 hover:text-stone-900 underline font-medium"
          >
            {interestSaved ? '✓ Stock interest recorded' : 'Save stock interest for later notification'}
          </button>
        </div>
      </form>
    </div>
  );
}
