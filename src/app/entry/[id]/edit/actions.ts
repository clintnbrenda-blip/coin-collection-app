"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getCheckedChecklistKeys } from "@/lib/checklist";

export interface EditEntryState {
  error: string | null;
}

export async function updateEntry(
  entryId: string,
  _prevState: EditEntryState,
  formData: FormData
): Promise<EditEntryState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const date = String(formData.get("date") ?? "");
  const daysSinceLast = Number(formData.get("days_since_last") ?? "");

  if (!date || !Number.isFinite(daysSinceLast) || daysSinceLast <= 0) {
    return { error: "Date and days since last (a positive number) are required." };
  }

  // RLS enforces "own entry within 1hr, or owner" — an update outside that
  // window simply matches 0 rows rather than throwing, so we check afterward.
  const { data: updated, error: entryError } = await supabase
    .from("collection_entries")
    .update({ date, days_since_last: daysSinceLast, edited_at: new Date().toISOString() })
    .eq("id", entryId)
    .select("id")
    .maybeSingle();

  if (entryError) {
    if (entryError.code === "23505") {
      return { error: `Another entry already exists for ${date}.` };
    }
    return { error: "Could not update the entry." };
  }
  if (!updated) {
    return { error: "You no longer have permission to edit this entry (past the 1-hour window)." };
  }

  // Quarters per machine group — update existing snapshot rows (trigger recomputes dollars/turns).
  const { data: snapshots } = await supabase
    .from("entry_group_snapshots")
    .select("id, machine_group_id")
    .eq("entry_id", entryId);

  for (const s of snapshots ?? []) {
    const raw = formData.get(`quarters_${s.machine_group_id}`);
    if (raw === null) continue;
    await supabase
      .from("entry_group_snapshots")
      .update({ quarters_collected: Number(raw) || 0 })
      .eq("id", s.id);
  }

  // Upsert (not just update) — an active vending machine may not yet have a
  // totals row for this entry (e.g. it was added after the entry was created).
  const { data: activeVendingMachines } = await supabase
    .from("vending_machines")
    .select("id")
    .eq("active", true);

  for (const vm of activeVendingMachines ?? []) {
    const cash = formData.get(`vending_cash_${vm.id}`);
    const coins = formData.get(`vending_coins_${vm.id}`);
    if (cash === null && coins === null) continue;
    await supabase.from("vending_totals").upsert(
      {
        entry_id: entryId,
        vending_machine_id: vm.id,
        cash_collected: Number(cash ?? 0) || 0,
        coins_collected: Number(coins ?? 0) || 0,
      },
      { onConflict: "entry_id,vending_machine_id" }
    );
  }

  // Bank deposit is managed separately now, via /deposits/[id] — not this form.

  const checkedItems = getCheckedChecklistKeys(formData);
  await supabase
    .from("checklist_completions")
    .update({
      checked_items: checkedItems,
      signed_by: String(formData.get("signed_by") ?? profile.fullName),
      signed_date: String(formData.get("signed_date") ?? date),
    })
    .eq("entry_id", entryId);

  redirect(`/entry/${entryId}`);
}
