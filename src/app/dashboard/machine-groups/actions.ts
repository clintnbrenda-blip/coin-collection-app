"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

async function requireOwner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    throw new Error("Only the owner can manage machine groups.");
  }
  return profile;
}

export interface UpdateMachineGroupState {
  error: string | null;
  entriesCorrected?: number;
}

export async function updateMachineGroup(
  formData: FormData
): Promise<UpdateMachineGroupState> {
  const profile = await requireOwner();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const qty = Number(formData.get("qty"));
  const price = Number(formData.get("price"));
  const effectiveDate = String(formData.get("effective_date") ?? "");
  const storeNumbersRaw = String(formData.get("store_numbers") ?? "").trim();
  const storeNumbers = storeNumbersRaw === "" ? null : storeNumbersRaw;

  if (!id || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
    return { error: "Qty and price must be positive numbers." };
  }

  const { data: current } = await supabase
    .from("machine_groups")
    .select("price")
    .eq("id", id)
    .single();

  // qty/store_numbers have no history to preserve — only ever affect
  // entries from now on, so a plain update is always safe.
  const { error: updateError } = await supabase
    .from("machine_groups")
    .update({ qty, store_numbers: storeNumbers })
    .eq("id", id);
  if (updateError) {
    return { error: "Could not save qty/store number." };
  }

  let entriesCorrected: number | undefined;

  // Price is different: route it through the dated history function instead
  // of a plain update, so the change is logged and (via effective date) can
  // retroactively fix any already-submitted entry that was stuck with the
  // wrong price because the real-world change happened before it was
  // entered into the app.
  if (current && Number(current.price) !== price) {
    if (!effectiveDate) {
      return { error: "Effective date is required when changing the price." };
    }
    const { data, error } = await supabase.rpc("correct_machine_group_price", {
      p_machine_group_id: id,
      p_new_price: price,
      p_effective_date: effectiveDate,
      p_changed_by: profile.id,
      p_changed_by_name: profile.fullName,
    });
    if (error) {
      return { error: "Could not save the price change." };
    }
    entriesCorrected = data?.entries_corrected;
  }

  revalidatePath("/dashboard/machine-groups");
  revalidatePath("/dashboard/machine-groups/log");
  return { error: null, entriesCorrected };
}

export async function retireMachineGroup(formData: FormData) {
  const profile = await requireOwner();
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { data: group } = await supabase
    .from("machine_groups")
    .select("name")
    .eq("id", id)
    .single();

  await supabase.from("machine_groups").update({ active: false }).eq("id", id);

  await supabase.from("machine_group_audit_log").insert({
    machine_group_id: id,
    machine_group_name: group?.name ?? "(unknown)",
    action: "retired",
    changed_by: profile.id,
    changed_by_name: profile.fullName,
  });

  revalidatePath("/dashboard/machine-groups");
  revalidatePath("/dashboard/machine-groups/log");
}

export async function reactivateMachineGroup(formData: FormData) {
  const profile = await requireOwner();
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { data: group } = await supabase
    .from("machine_groups")
    .select("name")
    .eq("id", id)
    .single();

  await supabase.from("machine_groups").update({ active: true }).eq("id", id);

  await supabase.from("machine_group_audit_log").insert({
    machine_group_id: id,
    machine_group_name: group?.name ?? "(unknown)",
    action: "reactivated",
    changed_by: profile.id,
    changed_by_name: profile.fullName,
  });

  revalidatePath("/dashboard/machine-groups");
  revalidatePath("/dashboard/machine-groups/log");
}

export async function addMachineGroup(formData: FormData) {
  const profile = await requireOwner();
  const supabase = await createClient();

  const { data: location } = await supabase.from("locations").select("id").limit(1).single();
  if (!location) throw new Error("No location found.");

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "washer");
  const qty = Number(formData.get("qty"));
  const price = Number(formData.get("price"));
  const storeNumbersRaw = String(formData.get("store_numbers") ?? "").trim();
  const storeNumbers = storeNumbersRaw === "" ? null : storeNumbersRaw;

  if (!name || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
    throw new Error("Name, qty, and price are required.");
  }
  if (type !== "washer" && type !== "dryer") {
    throw new Error("Type must be washer or dryer.");
  }

  const { data: maxOrder } = await supabase
    .from("machine_groups")
    .select("display_order")
    .eq("location_id", location.id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error: insertError } = await supabase
    .from("machine_groups")
    .insert({
      location_id: location.id,
      name,
      type,
      qty,
      price,
      store_numbers: storeNumbers,
      display_order: (maxOrder?.display_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (insertError || !created) {
    throw new Error("Could not add the machine group.");
  }

  // Baseline price-history row, dated today — gives the new group a
  // starting point so a future price correction has something to compare
  // against and a window to operate within.
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("machine_group_price_history").insert({
    machine_group_id: created.id,
    price,
    effective_date: today,
    changed_by: profile.id,
    changed_by_name: profile.fullName,
  });

  await supabase.from("machine_group_audit_log").insert({
    machine_group_id: created.id,
    machine_group_name: name,
    action: "added",
    details: { type, qty, price, store_numbers: storeNumbers },
    changed_by: profile.id,
    changed_by_name: profile.fullName,
  });

  revalidatePath("/dashboard/machine-groups");
  revalidatePath("/dashboard/machine-groups/log");
}

export async function addVendingMachine(formData: FormData) {
  await requireOwner();
  const supabase = await createClient();

  const { data: location } = await supabase.from("locations").select("id").limit(1).single();
  if (!location) throw new Error("No location found.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const { data: maxOrder } = await supabase
    .from("vending_machines")
    .select("display_order")
    .eq("location_id", location.id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("vending_machines").insert({
    location_id: location.id,
    name,
    display_order: (maxOrder?.display_order ?? 0) + 1,
  });
  revalidatePath("/dashboard/machine-groups");
}

export async function retireVendingMachine(formData: FormData) {
  await requireOwner();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("vending_machines").update({ active: false }).eq("id", id);
  revalidatePath("/dashboard/machine-groups");
}

export async function reactivateVendingMachine(formData: FormData) {
  await requireOwner();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("vending_machines").update({ active: true }).eq("id", id);
  revalidatePath("/dashboard/machine-groups");
}
