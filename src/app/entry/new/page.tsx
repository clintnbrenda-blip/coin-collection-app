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

  const { data: lastEntry } = await supabase
    .from("collection_entries")
    .select("date")
    .eq("location_id", location.id)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <EntryForm
      locationId={location.id}
      employeeName={profile.fullName}
      role={profile.role}
      machineGroups={machineGroups ?? []}
      vendingMachines={vendingMachines ?? []}
      lastEntryDate={lastEntry?.date ?? null}
    />
  );
}
