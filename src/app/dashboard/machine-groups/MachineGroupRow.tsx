"use client";

import { useActionState } from "react";
import {
  updateMachineGroup,
  retireMachineGroup,
  reactivateMachineGroup,
  type UpdateMachineGroupState,
} from "./actions";

const initialState: UpdateMachineGroupState = { error: null };

export function MachineGroupRow({
  id,
  name,
  type,
  qty,
  price,
  storeNumbers,
  active,
}: {
  id: string;
  name: string;
  type: string;
  qty: number;
  price: number;
  storeNumbers: string | null;
  active: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    (_prev: UpdateMachineGroupState, formData: FormData) => updateMachineGroup(formData),
    initialState
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div
      className={`rounded-lg border p-3 ${
        active ? "border-neutral-200" : "border-neutral-100 bg-neutral-50 opacity-60"
      }`}
    >
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={id} />
        <div className="min-w-[140px] flex-1">
          <p className="text-sm font-medium text-neutral-800">{name}</p>
          <p className="text-xs text-neutral-400">{type}</p>
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-neutral-500">Store #</label>
          <input
            type="text"
            name="store_numbers"
            placeholder="e.g. 2-5"
            defaultValue={storeNumbers ?? ""}
            disabled={!active}
            className="w-28 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-neutral-500">Qty</label>
          <input
            type="number"
            name="qty"
            min="1"
            defaultValue={qty}
            disabled={!active}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-neutral-500">Price</label>
          <input
            type="number"
            name="price"
            step="0.01"
            min="0.01"
            defaultValue={price}
            disabled={!active}
            className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-neutral-500">Effective</label>
          <input
            type="date"
            name="effective_date"
            defaultValue={today}
            disabled={!active}
            title="The date this price actually took effect in the store — if it's different from today, past entries in that window get corrected too."
            className="w-36 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        {active ? (
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        ) : null}
        <button
          type="submit"
          formAction={active ? retireMachineGroup : reactivateMachineGroup}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          {active ? "Retire" : "Reactivate"}
        </button>
      </form>
      {state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
      {!state.error && typeof state.entriesCorrected === "number" && state.entriesCorrected > 0 && (
        <p className="mt-2 text-xs text-green-700">
          Price updated — corrected {state.entriesCorrected} already-submitted entr
          {state.entriesCorrected === 1 ? "y" : "ies"} in that date range.
        </p>
      )}
    </div>
  );
}
