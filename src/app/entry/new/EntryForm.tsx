"use client";

import { useActionState, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { CHECKLIST_ITEMS } from "@/lib/checklist";
import { focusNextFieldOnEnter } from "@/lib/formKeyNav";
import { todayLocalISO, daysBetween } from "@/lib/dateMath";
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

  const [date, setDate] = useState(todayLocalISO());
  const computedDays = useMemo(
    () => (lastEntryDate ? daysBetween(date, lastEntryDate) : null),
    [date, lastEntryDate]
  );
  // Days since last is auto-calculated from the date field whenever a previous
  // entry exists — only editable as a manual fallback for the very first entry.
  const [manualDays, setManualDays] = useState<string>("");
  const effectiveDays = lastEntryDate ? String(computedDays ?? "") : manualDays;

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
        onKeyDown={focusNextFieldOnEnter}
        className="mx-auto max-w-2xl space-y-6 p-4"
      >
        <input type="hidden" name="location_id" value={locationId} />

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
                value={date}
                onChange={(e) => setDate(e.target.value)}
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
                onChange={(e) => setManualDays(e.target.value)}
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
                defaultValue={employeeName}
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
                defaultValue={todayLocalISO()}
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
