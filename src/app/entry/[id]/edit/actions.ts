"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getCheckedChecklistKeys, buildChecklistSnapshot } from "@/lib/checklist";
import {
  MAX_ENTRY_PHOTOS,
  collectPhotoFiles,
  discardUploadedPhotos,
  uploadEntryPhotos,
} from "@/lib/entryPhotos";

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
    .select("id, location_id")
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
    const quarters = formData.get(`vending_quarters_${vm.id}`);
    if (cash === null && quarters === null) continue;
    await supabase.from("vending_totals").upsert(
      {
        entry_id: entryId,
        vending_machine_id: vm.id,
        cash_collected: Number(cash ?? 0) || 0,
        // Quarters, not dollars — coins_collected is computed by a DB
        // trigger from this (quarters * 0.25), never set directly.
        quarters_collected: Number(quarters ?? 0) || 0,
      },
      { onConflict: "entry_id,vending_machine_id" }
    );
  }

  // Bank deposit is managed separately now, via /deposits/[id] — not this form.

  // Checklist — snapshot the item set at *this edit's* submit time, same as a
  // brand-new entry. Include retired items already checked on this entry's
  // existing completion (mirrors the filter the edit page uses to render the
  // form), so re-saving an old entry never drops a checkmark that was valid
  // when it was originally submitted.
  const checkedItems = getCheckedChecklistKeys(formData);

  const [{ data: existingCompletion }, { data: allChecklistItems }] = await Promise.all([
    supabase
      .from("checklist_completions")
      .select("checked_items")
      .eq("entry_id", entryId)
      .maybeSingle(),
    supabase
      .from("checklist_items")
      .select("key, section, text, active")
      .eq("location_id", updated.location_id)
      .order("display_order", { ascending: true }),
  ]);

  const previouslyChecked = existingCompletion?.checked_items ?? [];
  const relevantItems = (allChecklistItems ?? []).filter(
    (item) => item.active || previouslyChecked.includes(item.key)
  );
  const itemsSnapshot = buildChecklistSnapshot(relevantItems, checkedItems);

  await supabase
    .from("checklist_completions")
    .update({
      checked_items: checkedItems,
      items_snapshot: itemsSnapshot,
      signed_by: String(formData.get("signed_by") ?? profile.fullName),
      signed_date: String(formData.get("signed_date") ?? date),
    })
    .eq("entry_id", entryId);

  // Photos: add new ones and/or remove ones ticked "Remove". New uploads go
  // first so a failed upload never costs the photos already on file. Storage
  // RLS applies the same edit-window rule as the entry itself.
  const { data: existingPhotoRows } = await supabase
    .from("photos")
    .select("id, storage_path")
    .eq("entry_id", entryId)
    .eq("kind", "other");
  const existingPhotos = existingPhotoRows ?? [];
  const removeIds = new Set(formData.getAll("remove_photo").map(String));
  const toRemove = existingPhotos.filter((p) => removeIds.has(p.id));

  const newFiles = collectPhotoFiles(
    formData,
    MAX_ENTRY_PHOTOS - (existingPhotos.length - toRemove.length)
  );
  if (newFiles.length > 0) {
    const result = await uploadEntryPhotos(supabase, entryId, newFiles);
    if (result.error) {
      await discardUploadedPhotos(supabase, result.paths);
      return {
        error:
          "Your other changes were saved, but a photo failed to upload. Add the photo again and save.",
      };
    }
  }
  if (toRemove.length > 0) {
    await supabase
      .from("photos")
      .delete()
      .in(
        "id",
        toRemove.map((p) => p.id)
      );
    await supabase.storage
      .from("entry-photos")
      .remove(toRemove.map((p) => p.storage_path));
  }

  redirect(`/entry/${entryId}`);
}
