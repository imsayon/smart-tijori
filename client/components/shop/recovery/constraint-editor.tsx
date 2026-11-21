'use client';

import { useId, useState } from 'react';
import type { RecoveryConstraints } from '@/contracts';

interface ConstraintEditorProps {
  constraints: RecoveryConstraints;
  onApply: (updated: RecoveryConstraints) => void;
  isLoading?: boolean;
}

export function ConstraintEditor({ constraints, onApply, isLoading }: ConstraintEditorProps) {
  const budgetId = useId();
  const [budget, setBudget] = useState(
    constraints.maxPricePaise === undefined ? '' : String(constraints.maxPricePaise / 100),
  );

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-[#F5F1E8] p-4 text-sm"
      onSubmit={event => {
        event.preventDefault();
        onApply({ ...constraints, maxPricePaise: budget === '' ? undefined : Math.round(Number(budget) * 100) });
      }}
    >
      <div>
        <label htmlFor={budgetId} className="block font-semibold text-stone-700">Maximum price (₹)</label>
        <input
          id={budgetId}
          type="number"
          min="0"
          step="0.01"
          value={budget}
          onChange={event => setBudget(event.target.value)}
          className="mt-1 w-36 rounded-lg border border-stone-300 bg-white px-3 py-2"
        />
      </div>
      <button type="submit" disabled={isLoading} className="rounded-lg bg-[#173F35] px-4 py-2 font-semibold text-white disabled:opacity-50">
        Update alternatives
      </button>
    </form>
  );
}
