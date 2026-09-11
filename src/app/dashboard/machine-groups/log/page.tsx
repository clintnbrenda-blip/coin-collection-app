import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { formatMoney } from "@/lib/formatMoney";

function describe(entry: {
  action: string;
  machine_group_name: string;
  details: Record<string, unknown>;
}): string {
  const { action, machine_group_name, details } = entry;

  if (action === "added") {
    const qty = details.qty as number | undefined;
    const price = details.price as number | undefined;
    const storeNumbers = details.store_numbers as string | null | undefined;
    const parts = [
      qty !== undefined ? `qty ${qty}` : null,
      price !== undefined ? formatMoney(Number(price)) : null,
      storeNumbers ? `#${storeNumbers}` : null,
    ].filter(Boolean);
    return `Added "${machine_group_name}"${parts.length ? ` (${parts.join(", ")})` : ""}`;
  }

  if (action === "retired") {
    return `Retired "${machine_group_name}"`;
  }

  if (action === "reactivated") {
    return `Reactivated "${machine_group_name}"`;
  }

  if (action === "price_changed") {
    const oldPrice = details.old_price as number | undefined;
    const newPrice = details.new_price as number | undefined;
    const effectiveDate = details.effective_date as string | undefined;
    const corrected = details.entries_corrected as number | undefined;
    let text = `Changed price of "${machine_group_name}"`;
    if (oldPrice !== undefined && newPrice !== undefined) {
      text += ` from ${formatMoney(Number(oldPrice))} to ${formatMoney(Number(newPrice))}`;
    }
    if (effectiveDate) {
      text += `, effective ${effectiveDate}`;
    }
    if (corrected) {
      text += ` — corrected ${corrected} already-submitted entr${corrected === 1 ? "y" : "ies"}`;
    }
    return text;
  }

  return `${action} "${machine_group_name}"`;
}

export default async function MachineGroupLogPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/entry/new");

  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("machine_group_audit_log")
    .select("id, machine_group_name, action, details, changed_by_name, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader title="Change Log" fullName={profile.fullName} role={profile.role} activeTab="dashboard" />

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Link href="/dashboard/machine-groups" className="text-sm text-blue-600 hover:underline">
          ← Back to machine groups
        </Link>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Machine group changes</h2>
          {!entries || entries.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No changes logged yet — this only tracks additions, retirements, reactivations,
              and price changes made from here on.
            </p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.id} className="border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0">
                  <p className="text-sm text-neutral-800">
                    {describe({
                      action: entry.action,
                      machine_group_name: entry.machine_group_name,
                      details: entry.details ?? {},
                    })}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {new Date(entry.created_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {entry.changed_by_name}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
