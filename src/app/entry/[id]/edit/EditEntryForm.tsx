"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { CHECKLIST_ITEMS } from "@/lib/checklist";
import { focusNextFieldOnEnter } from "@/lib/formKeyNav";
import { daysBetween } from "@/lib/dateMath";
import { formatMoney } from "@/lib/formatMoney";
import { updateEntry, type EditEntryState } from "./actions";

interface MachineGroupField {
  machineGroupId: string;
  name: string;
  qty: number;
  price: number;
  storeNumbers: string | null;
  quartersCollected: number;
}

interface VendingMachineField {
  vendingMachineId: string;
  name: string;
  cashCollected: number;
  coinsCollected: number;
}

const initialState: EditEntryState = { error: null };

export function EditEntryForm({
  entryId,
  employeeName,
  role,
  date: initialDate,
  daysSinceLast,
  previousEntryDate,
  machineGroups,
  vendingMachines,
  depositAmount,
  checkedItems,
  signedBy,
  signedDate,
}: {
  entryId: string;
  employeeName: string;
  role: "owner" | "employee";
  date: string;
  daysSinceLast: string;
  previousEntryDate: string | null;
  machineGroups: MachineGroupField[];
  vendingMachines: VendingMachineField[];
  depositAmount: string;
  checkedItems: string[];
  signedBy: string;
  signedDate: string;
}) {
  const boundAction = updateEntry.bind(null, entryId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const [date, setDate] = useState(initialDate);
  const computedDays = useMemo(
    () => (previousEntryDate ? daysBetween(date, previousEntryDate) : null),
    [date, previousEntryDate]
  );
  const [manualDays, setManualDays] = useState(daysSinceLast);
  const effectiveDays = previousEntryDate ? String(computedDays ?? "") : manualDays;

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader
        title="Edit Collection Entry"
        fullName={employeeName}
        role={role}
        activeTab="collection"
      />

      <form
        action={formAction}
        onKeyDown={focusNextFieldOnEnter}
        className="mx-auto max-w-2xl space-y-6 p-4"
      >
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
                readOnly={!!previousEntryDate}
                required
                className={`w-full rounded-lg border px-3 py-2.5 text-base ${
                  previousEntryDate
                    ? "border-neutral-200 bg-neutral-100 text-neutral-600"
                    : "border-neutral-300"
                }`}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            {previousEntryDate
              ? `Calculated automatically from the date above (previous visit was ${previousEntryDate}).`
              : "No previous entry found before this one — enter the days manually."}
          </p>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Quarters collected</h2>
          <div className="space-y-3">
            {machineGroups.map((mg) => (
              <div key={mg.machineGroupId} className="flex items-center justify-between gap-3">
                <label
                  htmlFor={`quarters_${mg.machineGroupId}`}
                  className="text-sm text-neutral-700"
                >
                  {mg.storeNumbers && (
                    <span className="font-semibold text-neutral-900">#{mg.storeNumbers} · </span>
                  )}
                  {mg.name}
                  <span className="ml-1 text-xs text-neutral-400">
                    (qty {mg.qty} · {formatMoney(mg.price)})
                  </span>
                </label>
                <input
                  id={`quarters_${mg.machineGroupId}`}
                  name={`quarters_${mg.machineGroupId}`}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="0"
                  defaultValue={mg.quartersCollected || undefined}
                  className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-right text-base"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Vending</h2>
          <div className="space-y-4">
            {vendingMachines.map((vm) => (
              <div key={vm.vendingMachineId}>
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
                      name={`vending_cash_${vm.vendingMachineId}`}
                      placeholder="0"
                      defaultValue={vm.cashCollected || undefined}
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
                      name={`vending_coins_${vm.vendingMachineId}`}
                      placeholder="0"
                      defaultValue={vm.coinsCollected || undefined}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-1 font-semibold text-neutral-900">Bank deposit</h2>
          <p className="text-sm text-neutral-600">
            {depositAmount !== "0"
              ? `Currently recorded: ${formatMoney(Number(depositAmount))}.`
              : "Not recorded yet."}
          </p>
          <Link
            href={`/deposits/${entryId}`}
            className="mt-2 inline-block text-sm text-blue-600 hover:underline"
          >
            {depositAmount !== "0" ? "Update deposit" : "Submit deposit"} →
          </Link>
        </section>

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
              <h3 className="mb-2 text-sm font-medium text-neutral-500">{section}</h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <label key={item.key} className="flex items-start gap-2 text-sm text-neutral-800">
                    <input
                      type="checkbox"
                      name={`checklist_${item.key}`}
                      defaultChecked={checkedItems.includes(item.key)}
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
                defaultValue={signedBy}
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
                defaultValue={signedDate}
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
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
