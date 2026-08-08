import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EditEntryForm } from "./EditEntryForm";

const EDIT_WINDOW_MS = 60 * 60 * 1000;

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("collection_entries")
    .select("id, date, days_since_last, employee_id, created_at")
    .eq("id", id)
    .single();
  if (!entry) notFound();

  const isOwner = profile.role === "owner";
  const isMine = entry.employee_id === profile.id;
  const withinWindow = Date.now() - new Date(entry.created_at).getTime() < EDIT_WINDOW_MS;
  if (!isOwner && !(isMine && withinWindow)) notFound();

  const [
    { data: snapshots },
    { data: activeVendingMachines },
    { data: vendingRows },
    { data: deposit },
    { data: checklist },
  ] = await Promise.all([
    supabase
      .from("entry_group_snapshots")
      .select(
        "id, machine_group_id, quarters_collected, machine_groups(name, qty, price, display_order)"
      )
      .eq("entry_id", id),
    supabase
      .from("vending_machines")
      .select("id, name")
      .eq("active", true)
      .order("display_order"),
    supabase
      .from("vending_totals")
      .select("vending_machine_id, cash_collected, coins_collected")
      .eq("entry_id", id),
    supabase.from("deposits").select("*").eq("entry_id", id).maybeSingle(),
    supabase.from("checklist_completions").select("*").eq("entry_id", id).maybeSingle(),
  ]);

  const machineGroups = (snapshots ?? [])
    .map((s) => {
      const mg = Array.isArray(s.machine_groups) ? s.machine_groups[0] : s.machine_groups;
      return {
        machineGroupId: s.machine_group_id,
        name: mg?.name ?? "",
        qty: mg?.qty ?? 0,
        price: mg?.price ?? 0,
        quartersCollected: s.quarters_collected,
        displayOrder: mg?.display_order ?? 0,
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // Always show every active vending machine, pre-filled from any existing
  // totals row for this entry (or $0 if this entry predates that machine /
  // never had one saved — e.g. entries from before a schema change).
  const vendingMachines = (activeVendingMachines ?? []).map((vm) => {
    const existing = (vendingRows ?? []).find((v) => v.vending_machine_id === vm.id);
    return {
      vendingMachineId: vm.id,
      name: vm.name,
      cashCollected: existing?.cash_collected ?? 0,
      coinsCollected: existing?.coins_collected ?? 0,
    };
  });

  return (
    <EditEntryForm
      entryId={entry.id}
      employeeName={profile.fullName}
      date={entry.date}
      daysSinceLast={String(entry.days_since_last)}
      machineGroups={machineGroups}
      vendingMachines={vendingMachines}
      depositAmount={String(deposit?.deposit_amount ?? 0)}
      checkedItems={checklist?.checked_items ?? []}
      signedBy={checklist?.signed_by ?? profile.fullName}
      signedDate={checklist?.signed_date ?? entry.date}
    />
  );
}
