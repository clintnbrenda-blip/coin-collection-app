"use server";

import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

async function requireOwner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    throw new Error("Only the owner can export data.");
  }
  return profile;
}

export type ExportSection = "summary" | "machines" | "vending" | "deposits" | "checklist";

export interface ExportDataState {
  error: string | null;
  csv?: string;
  filename?: string;
}

/**
 * Builds one combined CSV covering any custom date range, with each checked
 * section as its own titled block (Excel opens this fine as a single sheet
 * with a few blank-row-separated tables — no extra library needed for a
 * "real" multi-sheet workbook, and this way one click always produces one
 * file no matter how many sections are picked).
 */
export async function exportDataCsv(
  from: string,
  to: string,
  sections: ExportSection[]
): Promise<ExportDataState> {
  await requireOwner();
  const supabase = await createClient();

  if (!from || !to) return { error: "Pick a start and end date." };
  if (from > to) return { error: "Start date must be before end date." };
  if (sections.length === 0) return { error: "Pick at least one type of data to include." };

  const { data: location } = await supabase.from("locations").select("id").limit(1).single();
  if (!location) return { error: "No location found." };

  const { data: entries, error: entriesError } = await supabase
    .from("collection_entries")
    .select(
      "id, date, days_since_last, total_income, avg_turns, income_per_day, profiles(full_name)"
    )
    .eq("location_id", location.id)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (entriesError) return { error: "Could not load entries for that range." };
  if (!entries || entries.length === 0) {
    return { error: "No entries found in that date range." };
  }

  const entryIds = entries.map((e) => e.id);
  const nameOf = (e: (typeof entries)[number]) => {
    const p = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    return p?.full_name ?? "—";
  };
  const dateOf = new Map(entries.map((e) => [e.id, e.date]));
  const empOf = new Map(entries.map((e) => [e.id, nameOf(e)]));
  const byDate = (aId: string, bId: string) =>
    (dateOf.get(aId) ?? "").localeCompare(dateOf.get(bId) ?? "");

  const blocks: string[] = [
    "Cypress Laundry export",
    `Range: ${from} to ${to}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    "",
  ];

  function pushSection(title: string, rows: Record<string, string | number>[]) {
    blocks.push(`== ${title} ==`);
    blocks.push(rows.length > 0 ? Papa.unparse(rows) : "(no data in this range)");
    blocks.push("");
  }

  if (sections.includes("summary")) {
    pushSection(
      "Summary",
      entries.map((e) => ({
        Date: e.date,
        Employee: nameOf(e),
        "Days since last": e.days_since_last,
        "Total income": Number(e.total_income ?? 0).toFixed(2),
        "Avg turns": e.avg_turns !== null ? Number(e.avg_turns).toFixed(1) : "",
        "Income/day": e.income_per_day !== null ? Number(e.income_per_day).toFixed(2) : "",
      }))
    );
  }

  if (sections.includes("machines")) {
    const { data: snaps } = await supabase
      .from("entry_group_snapshots")
      .select(
        "entry_id, quarters_collected, dollars, turns, machine_groups(name, store_numbers, display_order)"
      )
      .in("entry_id", entryIds);

    const sorted = [...(snaps ?? [])].sort((a, b) => {
      const byD = byDate(a.entry_id, b.entry_id);
      if (byD !== 0) return byD;
      const mgA = Array.isArray(a.machine_groups) ? a.machine_groups[0] : a.machine_groups;
      const mgB = Array.isArray(b.machine_groups) ? b.machine_groups[0] : b.machine_groups;
      return (mgA?.display_order ?? 0) - (mgB?.display_order ?? 0);
    });

    pushSection(
      "Machine groups",
      sorted.map((s) => {
        const mg = Array.isArray(s.machine_groups) ? s.machine_groups[0] : s.machine_groups;
        return {
          Date: dateOf.get(s.entry_id) ?? "",
          Employee: empOf.get(s.entry_id) ?? "",
          "Machine group": mg?.name ?? "",
          "Store #": mg?.store_numbers ?? "",
          Quarters: s.quarters_collected,
          Dollars: Number(s.dollars ?? 0).toFixed(2),
          Turns: Number(s.turns ?? 0).toFixed(1),
        };
      })
    );
  }

  if (sections.includes("vending")) {
    const { data: vend } = await supabase
      .from("vending_totals")
      .select("entry_id, cash_collected, coins_collected, vending_machines(name)")
      .in("entry_id", entryIds);

    const sorted = [...(vend ?? [])].sort((a, b) => byDate(a.entry_id, b.entry_id));

    pushSection(
      "Vending",
      sorted.map((v) => {
        const vm = Array.isArray(v.vending_machines) ? v.vending_machines[0] : v.vending_machines;
        return {
          Date: dateOf.get(v.entry_id) ?? "",
          Employee: empOf.get(v.entry_id) ?? "",
          Machine: vm?.name ?? "",
          Cash: Number(v.cash_collected ?? 0).toFixed(2),
          Coins: Number(v.coins_collected ?? 0).toFixed(2),
        };
      })
    );
  }

  if (sections.includes("deposits")) {
    const { data: deposits } = await supabase
      .from("deposits")
      .select("entry_id, deposit_amount, deposit_slip_photo_path")
      .in("entry_id", entryIds);

    const sorted = [...(deposits ?? [])].sort((a, b) => byDate(a.entry_id, b.entry_id));

    pushSection(
      "Deposits",
      sorted.map((d) => ({
        Date: dateOf.get(d.entry_id) ?? "",
        Employee: empOf.get(d.entry_id) ?? "",
        "Deposit amount": Number(d.deposit_amount ?? 0).toFixed(2),
        "Slip photo on file": d.deposit_slip_photo_path ? "Yes" : "No",
      }))
    );
  }

  if (sections.includes("checklist")) {
    const { data: checklists } = await supabase
      .from("checklist_completions")
      .select("entry_id, signed_by, signed_date, items_snapshot")
      .in("entry_id", entryIds);

    const sorted = [...(checklists ?? [])].sort((a, b) => byDate(a.entry_id, b.entry_id));

    const rows: Record<string, string>[] = [];
    for (const c of sorted) {
      const date = dateOf.get(c.entry_id) ?? "";
      const emp = empOf.get(c.entry_id) ?? "";
      const items = c.items_snapshot ?? [];
      if (items.length === 0) {
        rows.push({
          Date: date,
          Employee: emp,
          "Signed by": c.signed_by,
          "Signed date": c.signed_date,
          Item: "",
          Checked: "",
        });
        continue;
      }
      for (const item of items) {
        rows.push({
          Date: date,
          Employee: emp,
          "Signed by": c.signed_by,
          "Signed date": c.signed_date,
          Item: item.text,
          Checked: item.checked ? "Yes" : "No",
        });
      }
    }
    pushSection("Checklist", rows);
  }

  return {
    error: null,
    csv: blocks.join("\n"),
    filename: `cypress-laundry-export-${from}-to-${to}.csv`,
  };
}
