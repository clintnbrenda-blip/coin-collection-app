// Historical data import — reads scripts/historical_visits.json (extracted
// and cleaned from "2026 Coin collection.xlsx", see the conversation history
// for how the date corrections and Top Loader Washer exclusion were derived)
// and creates real collection_entries + entry_group_snapshots rows for each
// past visit, going through the same DB triggers that compute dollars/turns
// for live entries — so historical numbers are calculated exactly the same
// way as everything going forward.
//
// Usage:
//   node scripts/import-history.mjs             (dry run — reports only)
//   node scripts/import-history.mjs --commit     (actually writes)

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = Object.fromEntries(
  readFileSync(path.join(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const commit = process.argv.includes("--commit");

const visits = JSON.parse(
  readFileSync(path.join(__dirname, "historical_visits.json"), "utf8")
);

// --- Preconditions ---

const { data: location } = await supabase.from("locations").select("id").limit(1).single();
if (!location) {
  console.error("No location found. Run migration 0001 first.");
  process.exit(1);
}

const { data: owner } = await supabase
  .from("profiles")
  .select("id, full_name")
  .eq("role", "owner")
  .limit(1)
  .maybeSingle();
if (!owner) {
  console.error(
    "No owner profile found. Historical entries are attributed to the owner account " +
      "(the spreadsheet didn't track which employee did each collection) — create/promote " +
      "an owner account first."
  );
  process.exit(1);
}

const { data: machineGroups } = await supabase
  .from("machine_groups")
  .select("id, name, display_order")
  .eq("location_id", location.id)
  .order("display_order", { ascending: true });

if (!machineGroups || machineGroups.length !== 8) {
  console.error(`Expected 8 machine groups, found ${machineGroups?.length ?? 0}.`);
  process.exit(1);
}

const positionToGroupId = new Map(machineGroups.map((mg, i) => [i + 1, mg.id]));

const { data: existingEntries } = await supabase
  .from("collection_entries")
  .select("date")
  .eq("location_id", location.id);
const existingDates = new Set((existingEntries ?? []).map((e) => e.date));

console.log(`Location: ${location.id}`);
console.log(`Attributing all historical entries to owner: ${owner.full_name} (${owner.id})`);
console.log(`Visits to import: ${visits.length}`);
console.log(`Mode: ${commit ? "COMMIT (writing to database)" : "DRY RUN (no writes)"}`);
console.log("");

let imported = 0;
let skipped = 0;
let failed = 0;

for (const visit of visits) {
  if (existingDates.has(visit.date)) {
    console.log(`SKIP  ${visit.date} — an entry already exists for this date.`);
    skipped++;
    continue;
  }

  if (!commit) {
    const total = visit.snapshots.reduce((s, x) => s + x.quarters, 0);
    console.log(`DRY   ${visit.date}  days=${visit.days_since_last}  total_quarters=${total}`);
    imported++;
    continue;
  }

  const { data: entry, error: entryError } = await supabase
    .from("collection_entries")
    .insert({
      location_id: location.id,
      employee_id: owner.id,
      date: visit.date,
      days_since_last: visit.days_since_last,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    console.error(`FAIL  ${visit.date} — ${entryError?.message}`);
    failed++;
    continue;
  }

  const snapshotRows = visit.snapshots.map((s) => ({
    entry_id: entry.id,
    machine_group_id: positionToGroupId.get(s.position),
    qty_at_time: s.qty,
    price_at_time: s.price,
    quarters_collected: s.quarters,
  }));

  const { error: snapError } = await supabase
    .from("entry_group_snapshots")
    .insert(snapshotRows);

  if (snapError) {
    console.error(`FAIL  ${visit.date} — snapshot insert: ${snapError.message}`);
    // Roll back the orphaned entry.
    await supabase.from("collection_entries").delete().eq("id", entry.id);
    failed++;
    continue;
  }

  console.log(`OK    ${visit.date}  (entry ${entry.id})`);
  imported++;
}

console.log("");
console.log(`Done. imported=${imported} skipped=${skipped} failed=${failed}`);
if (!commit) {
  console.log("This was a dry run — re-run with --commit to actually write to the database.");
}
