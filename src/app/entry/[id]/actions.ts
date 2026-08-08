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
  await supabase.from("collection_entries").delete().eq("id", entryId);

  redirect(profile.role === "owner" ? "/dashboard" : "/entry/new");
}
