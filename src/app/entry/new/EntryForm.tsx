"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { CHECKLIST_ITEMS } from "@/lib/checklist";
import { focusNextFieldOnEnter } from "@/lib/formKeyNav";
import { todayLocalISO, daysBetween } from "@/lib/dateMath";
import { loadDraft, saveDraft, markPendingSubmit, type EntryDraft } from "@/lib/entryDraft";
import { submitEntry, type SubmitEntryState } from "./actions";

interface MachineGroup {
  id: string;
  name: string;
  type: "washer" | "dryer";
  qty: number;
  price: number;
  display_order: number;
}

interface VendingMachine {
  id: string;
  name: string;
  display_order: number;
}

const initialState: SubmitEntryState = { error: null };

function defaultDraft(employeeName: string): EntryDraft {
  const today = todayLocalISO();
  return {
    date: today,
    manualDays: "",
    quarters: {},
    vendingCash: {},
    vendingCoins: {},
    depositAmount: "",
    checkedItems: {},
    signedBy: employeeName,
    signedDate: today,
  };
}

export function EntryForm({
  locationId,
  employeeName,
  role,
  machineGroups,
  vendingMachines,
  lastEntryDate,
}: {
  locationId: string;
  employeeName: string;
  role: "owner" | "employee";
  machineGroups: MachineGroup[];
  vendingMachines: VendingMachine[];
  lastEntryDate: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitEntry, initialState);

  // Start with SSR-safe defaults, then pull in anything saved on this device
  // right after mount (avoids a hydration mismatch from reading storage
  // during the initial render).
  const [draft, setDraft] = useState<EntryDraft>(() => defaultDraft(employeeName));
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    // Syncing in from an external system (this device's storage) on mount —
    // there's no way to derive this during render since it's unavailable
    // server-side, so an effect is the correct tool here.
    const saved = loadDraft();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft((prev) => ({ ...prev, ...saved }));
      setRestored(true);
    }
  }, []);

  function update(partial: Partial<EntryDraft>) {
    setDraft((prev) => {
      const next = { ...prev, ...partial };
      saveDraft(next);
      return next;
    });
  }

  function updateMap(
    field: "quarters" | "vendingCash" | "vendingCoins",
    id: string,
    value: string
  ) {
    setDraft((prev) => {
      const next = { ...prev, [field]: { ...prev[field], [id]: value } };
      saveDraft(next);
      return next;
    });
  }

  function toggleChecklistItem(key: string, checked: boolean) {
    setDraft((prev) => {
      const next = { ...prev, checkedItems: { ...prev.checkedItems, [key]: checked } };
      saveDraft(next);
      return next;
    });
  }

  const computedDays = useMemo(
    () => (lastEntryDate ? daysBetween(draft.date, lastEntryDate) : null),
    [draft.date, lastEntryDate]
  );
  // Days since last is auto-calculated from the date field whenever a previous
  // entry exists — only editable as a manual fallback for the very first entry.
  const effectiveDays = lastEntryDate ? String(computedDays ?? "") : draft.manualDays;

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader
        title="New Collection Entry"
        fullName={employeeName}
        role={role}
        activeTab="collection"
      />

      <form
        action={formAction}
        onSubmit={markPendingSubmit}
        onKeyDown={focusNextFieldOnEnter}
        className="mx-auto max-w-2xl space-y-6 p-4"
      >
        <input type="hidden" name="location_id" value={locationId} />

        {restored && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Restored what you&apos;d already entered before this page closed.
          </p>
        )}

        {/* Date & days since last */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Visit details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Date
              </label>
              <input
                type="date"
                name="date"
                value={draft.date}
                onChange={(e) => update({ date: e.target.value })}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Days since last
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                name="days_since_last"
                value={effectiveDays}
                onChange={(e) => update({ manualDays: e.target.value })}
                readOnly={!!lastEntryDate}
                required
                className={`w-full rounded-lg border px-3 py-2.5 text-base ${
                  lastEntryDate
                    ? "border-neutral-200 bg-neutral-100 text-neutral-600"
                    : "border-neutral-300"
                }`}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            {lastEntryDate
              ? `Calculated automatically from the date above (last visit was ${lastEntryDate}).`
              : "No previous entry found for this location — enter the days manually."}
          </p>
        </section>

        {/* Machine groups */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">
            Quarters collected
          </h2>
          <div className="space-y-3">
            {machineGroups.map((mg) => (
              <div key={mg.id} className="flex items-center justify-between gap-3">
                <label
                  htmlFor={`quarters_${mg.id}`}
                  className="text-sm text-neutral-700"
                >
                  {mg.name}
                  <span className="ml-1 text-xs text-neutral-400">
                    (qty {mg.qty} · ${mg.price.toFixed(2)})
                  </span>
                </label>
                <input
                  id={`quarters_${mg.id}`}
                  name={`quarters_${mg.id}`}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={draft.quarters[mg.id] ?? ""}
                  onChange={(e) => updateMap("quarters", mg.id, e.target.value)}
                  className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-right text-base"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Vending */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Vending</h2>
          <div className="space-y-4">
            {vendingMachines.map((vm) => (
              <div key={vm.id}>
                <p className="mb-1.5 text-sm font-medium text-neutral-700">{vm.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">
                      Cash collected
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name={`vending_cash_${vm.id}`}
                      placeholder="0"
                      value={draft.vendingCash[vm.id] ?? ""}
                      onChange={(e) => updateMap("vendingCash", vm.id, e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">
                      Coins collected
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name={`vending_coins_${vm.id}`}
                      placeholder="0"
                      value={draft.vendingCoins[vm.id] ?? ""}
                      onChange={(e) => updateMap("vendingCoins", vm.id, e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bank deposit */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Bank deposit</h2>
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
                value={draft.depositAmount}
                onChange={(e) => update({ depositAmount: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Deposit slip photo
              </label>
              <input
                type="file"
                name="deposit_slip_photo"
                accept="image/*"
                capture="environment"
                className="w-full text-sm"
              />
              <p className="mt-1 text-xs text-neutral-400">
                Photos aren&apos;t saved if you leave this page — everything else is.
              </p>
            </div>
            <details className="text-sm text-neutral-600">
              <summary className="cursor-pointer select-none">
                Optional: coin collection / balance sheet photos
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Coin collection sheet photo
                  </label>
                  <input
                    type="file"
                    name="coin_collection_sheet_photo"
                    accept="image/*"
                    capture="environment"
                    className="w-full text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">
                    Coin balance sheet photo
                  </label>
                  <input
                    type="file"
                    name="coin_balance_sheet_photo"
                    accept="image/*"
                    capture="environment"
                    className="w-full text-sm"
                  />
                </div>
              </div>
            </details>
          </div>
        </section>

        {/* Checklist */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Checklist</h2>
          {Object.entries(
            CHECKLIST_ITEMS.reduce<Record<string, typeof CHECKLIST_ITEMS>>(
              (groups, item) => {
                (groups[item.section] ??= []).push(item);
                return groups;
              },
              {}
            )
          ).map(([section, items]) => (
            <div key={section} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-sm font-medium text-neutral-500">
                {section}
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-2 text-sm text-neutral-800"
                  >
                    <input
                      type="checkbox"
                      name={`checklist_${item.key}`}
                      checked={draft.checkedItems[item.key] ?? false}
                      onChange={(e) => toggleChecklistItem(item.key, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                    />
                    {item.text}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Signed by
              </label>
              <input
                type="text"
                name="signed_by"
                value={draft.signedBy}
                onChange={(e) => update({ signedBy: e.target.value })}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Date
              </label>
              <input
                type="date"
                name="signed_date"
                value={draft.signedDate}
                onChange={(e) => update({ signedDate: e.target.value })}
                required
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
              />
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
          {pending ? "Submitting…" : "Submit collection"}
        </button>
      </form>
    </div>
  );
}
