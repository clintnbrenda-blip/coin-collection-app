"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { CHECKLIST_ITEMS } from "@/lib/checklist";

export interface SubmitEntryState {
  error: string | null;
}

export async function submitEntry(
  _prevState: SubmitEntryState,
  formData: FormData
): Promise<SubmitEntryState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const locationId = String(formData.get("location_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const daysSinceLastRaw = String(formData.get("days_since_last") ?? "");
  const daysSinceLast = Number(daysSinceLastRaw);

  if (!locationId || !date) {
    return { error: "Missing location or date." };
  }
  if (!daysSinceLastRaw || !Number.isFinite(daysSinceLast) || daysSinceLast <= 0) {
    return {
      error: "Days since last collection must be a positive number.",
    };
  }

  // Snapshot the *current* machine groups at submit time.
  const { data: machineGroups, error: mgError } = await supabase
    .from("machine_groups")
    .select("id, qty, price")
    .eq("location_id", locationId)
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (mgError || !machineGroups) {
    return { error: "Could not load machine groups. Try again." };
  }

  // 1. Create the entry.
  const { data: entry, error: entryError } = await supabase
    .from("collection_entries")
    .insert({
      location_id: locationId,
      employee_id: profile.id,
      date,
      days_since_last: daysSinceLast,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    if (entryError?.code === "23505") {
      return {
        error: `An entry already exists for ${date}. Edit that one instead of creating a new one.`,
      };
    }
    return { error: "Could not save the entry. Try again." };
  }

  const entryId = entry.id;

  // Everything past this point rolls back the entry (and cascades) on failure.
  try {
    // 2. Per-machine-group quarters -> snapshot rows.
    const snapshotRows = machineGroups.map((mg) => ({
      entry_id: entryId,
      machine_group_id: mg.id,
      qty_at_time: mg.qty,
      price_at_time: mg.price,
      quarters_collected: Number(formData.get(`quarters_${mg.id}`) ?? 0) || 0,
    }));

    const { error: snapError } = await supabase
      .from("entry_group_snapshots")
      .insert(snapshotRows);
    if (snapError) throw new Error("Could not save machine group totals.");

    // 3. Vending — one row per vending machine.
    const { data: vendingMachines } = await supabase
      .from("vending_machines")
      .select("id")
      .eq("location_id", locationId)
      .eq("active", true);

    const vendingRows = (vendingMachines ?? []).map((vm) => ({
      entry_id: entryId,
      vending_machine_id: vm.id,
      cash_collected: Number(formData.get(`vending_cash_${vm.id}`) ?? 0) || 0,
      coins_collected: Number(formData.get(`vending_coins_${vm.id}`) ?? 0) || 0,
    }));

    if (vendingRows.length > 0) {
      const { error: vendError } = await supabase
        .from("vending_totals")
        .insert(vendingRows);
      if (vendError) throw new Error("Could not save vending totals.");
    }

    // 4. Deposit + optional slip photo.
    const depositAmount = Number(formData.get("deposit_amount") ?? 0) || 0;
    let depositSlipPath: string | null = null;

    const depositPhoto = formData.get("deposit_slip_photo") as File | null;
    if (depositPhoto && depositPhoto.size > 0) {
      depositSlipPath = await uploadEntryPhoto(
        supabase,
        entryId,
        depositPhoto,
        "deposit-slip"
      );
      await supabase.from("photos").insert({
        entry_id: entryId,
        storage_path: depositSlipPath,
        kind: "deposit_slip",
      });
    }

    const { error: depError } = await supabase.from("deposits").insert({
      entry_id: entryId,
      deposit_amount: depositAmount,
      deposit_slip_photo_path: depositSlipPath,
    });
    if (depError) throw new Error("Could not save the deposit.");

    // 5. Optional extra photos (coin collection sheet / coin balance sheet).
    const collectionSheetPhoto = formData.get(
      "coin_collection_sheet_photo"
    ) as File | null;
    if (collectionSheetPhoto && collectionSheetPhoto.size > 0) {
      const path = await uploadEntryPhoto(
        supabase,
        entryId,
        collectionSheetPhoto,
        "coin-collection-sheet"
      );
      await supabase
        .from("photos")
        .insert({ entry_id: entryId, storage_path: path, kind: "coin_collection_sheet" });
    }

    const balanceSheetPhoto = formData.get(
      "coin_balance_sheet_photo"
    ) as File | null;
    if (balanceSheetPhoto && balanceSheetPhoto.size > 0) {
      const path = await uploadEntryPhoto(
        supabase,
        entryId,
        balanceSheetPhoto,
        "coin-balance-sheet"
      );
      await supabase
        .from("photos")
        .insert({ entry_id: entryId, storage_path: path, kind: "coin_balance_sheet" });
    }

    // 6. Checklist completion.
    const checkedItems = CHECKLIST_ITEMS.filter(
      (item) => formData.get(`checklist_${item.key}`) === "on"
    ).map((item) => item.key);

    const signedBy = String(formData.get("signed_by") ?? profile.fullName);
    const signedDate = String(formData.get("signed_date") ?? date);

    const { error: checklistError } = await supabase
      .from("checklist_completions")
      .insert({
        entry_id: entryId,
        checked_items: checkedItems,
        signed_by: signedBy,
        signed_date: signedDate,
      });
    if (checklistError) throw new Error("Could not save the checklist.");
  } catch (err) {
    // Roll back — deleting the entry cascades every child row.
    await supabase.from("collection_entries").delete().eq("id", entryId);
    return {
      error: err instanceof Error ? err.message : "Something went wrong saving the entry.",
    };
  }

  redirect(`/entry/${entryId}`);
}

async function uploadEntryPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entryId: string,
  file: File,
  label: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${entryId}/${label}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("entry-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Could not upload ${label} photo.`);
  return path;
}
