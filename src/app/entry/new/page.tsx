import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EntryForm } from "./EntryForm";

export default async function NewEntryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const { data: location } = await supabase
    .from("locations")
    .select("id, name")
    .limit(1)
    .single();

  if (!location) {
    return (
      <div className="p-6 text-center text-neutral-600">
        No location is set up yet. Ask the owner to add one.
      </div>
    );
  }

  const { data: machineGroups } = await supabase
    .from("machine_groups")
    .select("id, name, type, qty, price, store_numbers, display_order")
    .eq("location_id", location.id)
    .eq("active", true)
    .order("display_order", { ascending: true });

  const { data: vendingMachines } = await supabase
    .from("vending_machines")
    .select("id, name, display_order")
    .eq("location_id", location.id)
    .eq("active", true)
    .order("display_order", { ascending: true });

  // Most recent visit by ANYONE (a DB function, since RLS only lets an
  // employee read their own entries). Days-since-last depends on this.
  const { data: lastEntryDate } = await supabase.rpc("last_entry_date", {
    p_location_id: location.id,
  });

  // Newest entry this user can see, by when it was submitted (not by its
  // date) — lets the form tell whether a saved draft predates a submission.
  const { data: latestEntry } = await supabase
    .from("collection_entries")
    .select("id")
    .eq("location_id", location.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: checklistItems } = await supabase
    .from("checklist_items")
    .select("key, section, text")
    .eq("location_id", location.id)
    .eq("active", true)
    .order("display_order", { ascending: true });

  return (
    <EntryForm
      locationId={location.id}
      employeeName={profile.fullName}
      role={profile.role}
      machineGroups={machineGroups ?? []}
      vendingMachines={vendingMachines ?? []}
      checklistItems={checklistItems ?? []}
      lastEntryDate={lastEntryDate ?? null}
      latestEntryId={latestEntry?.id ?? null}
    />
  );
}
