"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

async function requireOwner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    throw new Error("Only the owner can manage the checklist.");
  }
  return profile;
}

export async function updateChecklistItem(formData: FormData) {
  await requireOwner();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const section = String(formData.get("section") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();

  if (!id || !section || !text) {
    throw new Error("Section and checklist text are required.");
  }

  // Editing wording/section is always safe to apply retroactively — unlike
  // machine groups' qty/price, there's no historical snapshot to protect.
  // The item's `key` (what past checked_items arrays reference) never
  // changes, so old entries' checked/unchecked state stays intact either way.
  await supabase.from("checklist_items").update({ section, text }).eq("id", id);
  revalidatePath("/dashboard/checklist");
}

export async function retireChecklistItem(formData: FormData) {
  await requireOwner();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("checklist_items").update({ active: false }).eq("id", id);
  revalidatePath("/dashboard/checklist");
}

export async function reactivateChecklistItem(formData: FormData) {
  await requireOwner();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("checklist_items").update({ active: true }).eq("id", id);
  revalidatePath("/dashboard/checklist");
}

export interface DeleteChecklistItemState {
  error: string | null;
}

export async function deleteChecklistItem(
  formData: FormData
): Promise<DeleteChecklistItemState> {
  await requireOwner();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const key = String(formData.get("key"));
  if (!id || !key) return { error: "Missing item." };

  // Only allow a true, permanent delete for an item that has never actually
  // been checked on a real submitted entry — otherwise this would silently
  // erase a checkmark from historical records. checked_items is a text[];
  // .contains() maps to Postgres's @> ("array contains this element").
  //
  // Returns a result object instead of throwing — Next.js redacts a thrown
  // Server Action error's message in production ("An error occurred in the
  // Server Components render...") for security, which was swallowing this
  // function's actual explanation and just showing a generic error instead.
  const { count, error: lookupError } = await supabase
    .from("checklist_completions")
    .select("entry_id", { count: "exact", head: true })
    .contains("checked_items", [key]);

  if (lookupError) {
    return { error: "Could not verify whether this item is used on any entry." };
  }
  if (count && count > 0) {
    return {
      error:
        "Can't delete — this item is checked on at least one submitted entry. Retire it instead to keep that history intact.",
    };
  }

  const { error: deleteError } = await supabase.from("checklist_items").delete().eq("id", id);
  if (deleteError) {
    return { error: "Could not delete this item. Try again." };
  }

  revalidatePath("/dashboard/checklist");
  return { error: null };
}

export async function addChecklistItem(formData: FormData) {
  const profile = await requireOwner();
  const supabase = await createClient();

  const { data: location } = await supabase.from("locations").select("id").limit(1).single();
  if (!location) throw new Error("No location found.");

  const section = String(formData.get("section") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();

  if (!section || !text) {
    throw new Error("Section and checklist text are required.");
  }

  const { data: maxOrder } = await supabase
    .from("checklist_items")
    .select("display_order")
    .eq("location_id", location.id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  // New items don't need a human-meaningful key like the seeded ones have —
  // a fresh random one is exactly as good a stable reference, and this way
  // the owner never has to think about it.
  const key = crypto.randomUUID();

  await supabase.from("checklist_items").insert({
    location_id: location.id,
    key,
    section,
    text,
    display_order: (maxOrder?.display_order ?? 0) + 1,
  });

  void profile;
  revalidatePath("/dashboard/checklist");
}
