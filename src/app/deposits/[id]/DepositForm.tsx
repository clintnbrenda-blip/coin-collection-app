"use client";

import { useActionState, useEffect, useState } from "react";
import { focusNextFieldOnEnter } from "@/lib/formKeyNav";
import { PhotoPickerInput } from "@/components/PhotoPickerInput";
import { submitDeposit, type SubmitDepositState } from "./actions";

const initialState: SubmitDepositState = { error: null };

function draftKey(entryId: string) {
  return `coin-app:deposit-draft:${entryId}`;
}

export function DepositForm({
  entryId,
  date,
  existingAmount,
  hasExistingPhoto,
}: {
  entryId: string;
  date: string;
  existingAmount: number | null;
  hasExistingPhoto: boolean;
}) {
  const boundAction = submitDeposit.bind(null, entryId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const [amount, setAmount] = useState(existingAmount ? String(existingAmount) : "");

  // Restore a saved-but-unsubmitted amount for this specific entry, if any.
  useEffect(() => {
    // Syncing in from this device's storage on mount — unavailable
    // server-side, so an effect is the correct tool here.
    try {
      const saved = localStorage.getItem(draftKey(entryId));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved !== null) setAmount(saved);
    } catch {
      // ignore
    }
  }, [entryId]);

  function handleAmountChange(value: string) {
    setAmount(value);
    try {
      localStorage.setItem(draftKey(entryId), value);
    } catch {
      // ignore
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey(entryId));
    } catch {
      // ignore
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={clearDraft}
      onKeyDown={focusNextFieldOnEnter}
      className="mx-auto max-w-2xl space-y-6 p-4"
    >
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-1 font-semibold text-neutral-900">Collection date: {date}</h2>
        {existingAmount !== null && (
          <p className="mb-3 text-xs text-amber-700">
            A deposit of ${existingAmount.toFixed(2)} is already recorded for this entry —
            submitting again will replace it.
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Deposit amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="deposit_amount"
              placeholder="0"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
            />
          </div>
          <div>
            <PhotoPickerInput
              name="deposit_slip_photo"
              label={`Deposit slip photo${hasExistingPhoto ? " (replace)" : ""}`}
            />
            <p className="mt-1 text-xs text-neutral-400">
              Photo can&apos;t be saved as a draft — attach it right before submitting.
            </p>
          </div>
        </div>
      </section>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit deposit"}
      </button>
    </form>
  );
}
