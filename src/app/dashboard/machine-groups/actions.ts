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

export async function updateMachineGroup(formData: FormData) {
  await requireOwner();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const qty = Number(formData.get("qty"));
  const price = Number(formData.get("price"));

  if (!id || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
    throw new Error("Qty and price must be positive numbers.");
  }

  // Only affects entries created from now on — past entries keep their
  // qty_at_time/price_at_time snapshot, so this never rewrites history.
  await supabase.from("machine_groups").update({ qty, price }).eq("id", id);
  revalidatePath("/dashboard/machine-groups");
}

export async function retireMachineGroup(formData: FormData) {
  await requireOwner();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("machine_groups").update({ active: false }).eq("id", id);
  revalidatePath("/dashboard/machine-groups");
}

export async function reactivateMachineGroup(formData: FormData) {
  await requireOwner();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("machine_groups").update({ active: true }).eq("id", id);
  revalidatePath("/dashboard/machine-groups");
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

  await supabase.from("machine_groups").insert({
    location_id: location.id,
    name,
    type,
    qty,
    price,
    display_order: (maxOrder?.display_order ?? 0) + 1,
  });

  void profile;
  revalidatePath("/dashboard/machine-groups");
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
