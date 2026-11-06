"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function deleteEntry(entryId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  // RLS enforces the "own entry within 1hr, or owner" rule server-side —
  // this delete simply fails silently (0 rows affected) if not permitted.

  // Photo files live in storage, which the entry delete's cascade doesn't
  // touch, so they're removed explicitly below to avoid leaving orphans.
  const [{ data: photoRows }, { data: depositRow }] = await Promise.all([
    supabase.from("photos").select("storage_path").eq("entry_id", entryId),
    supabase
      .from("deposits")
      .select("deposit_slip_photo_path")
      .eq("entry_id", entryId)
      .maybeSingle(),
  ]);
  const paths = new Set((photoRows ?? []).map((p) => p.storage_path));
  if (depositRow?.deposit_slip_photo_path) paths.add(depositRow.deposit_slip_photo_path);

  // Files first: storage's delete rule looks up the parent entry, so after
  // the entry is gone they could no longer be removed. That rule is the same
  // "own within 1 hour, or owner" as the entry's own delete rule, so a
  // request the entry delete would refuse leaves the files alone too.
  if (paths.size > 0) {
    await supabase.storage.from("entry-photos").remove([...paths]);
  }
  await supabase.from("collection_entries").delete().eq("id", entryId);

  redirect(profile.role === "owner" ? "/dashboard" : "/entry/new");
}
