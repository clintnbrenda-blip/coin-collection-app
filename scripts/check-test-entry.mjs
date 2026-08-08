import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Minimal .env.local loader (no dotenv dependency needed for this one-off check).
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const entryId = process.argv[2];
if (!entryId) {
  console.error("Usage: node scripts/check-test-entry.mjs <entry_id>");
  process.exit(1);
}

const { data: entry } = await supabase
  .from("collection_entries")
  .select("*")
  .eq("id", entryId)
  .single();
console.log("ENTRY:", entry);

const { data: snapshots } = await supabase
  .from("entry_group_snapshots")
  .select("*, machine_groups(name, type)")
  .eq("entry_id", entryId);
console.log("\nSNAPSHOTS:");
for (const s of snapshots ?? []) {
  console.log(
    ` ${s.machine_groups.name} (${s.machine_groups.type}): qty=${s.qty_at_time} price=${s.price_at_time} quarters=${s.quarters_collected} -> dollars=${s.dollars} turns=${s.turns}`
  );
}
