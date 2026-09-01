import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { formatMoney } from "@/lib/formatMoney";
import { PrintButton } from "@/components/PrintButton";
import type { ExportSection } from "../actions";

export default async function ExportReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; sections?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/entry/new");

  const sp = await searchParams;
  const from = sp.from ?? "";
  const to = sp.to ?? "";
  const sections = new Set(
    (sp.sections ?? "").split(",").filter(Boolean) as ExportSection[]
  );

  if (!from || !to) redirect("/dashboard/export");

  const supabase = await createClient();

  const { data: location } = await supabase.from("locations").select("id").limit(1).single();

  const { data: entries } = await supabase
    .from("collection_entries")
    .select(
      "id, date, days_since_last, total_income, avg_turns, income_per_day, profiles(full_name)"
    )
    .eq("location_id", location?.id ?? "")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  const entryIds = (entries ?? []).map((e) => e.id);
  const dateOf = new Map((entries ?? []).map((e) => [e.id, e.date]));
  const byDate = (aId: string, bId: string) =>
    (dateOf.get(aId) ?? "").localeCompare(dateOf.get(bId) ?? "");

  let snaps: {
    entry_id: string;
    quarters_collected: number;
    dollars: number;
    turns: number;
    machine_groups: { name: string; store_numbers: string | null; display_order: number } | { name: string; store_numbers: string | null; display_order: number }[] | null;
  }[] = [];
  let vend: {
    entry_id: string;
    cash_collected: number;
    coins_collected: number;
    vending_machines: { name: string } | { name: string }[] | null;
  }[] = [];
  let deposits: { entry_id: string; deposit_amount: number; deposit_slip_photo_path: string | null }[] = [];
  let checklists: {
    entry_id: string;
    signed_by: string;
    signed_date: string;
    items_snapshot: { section: string; text: string; checked: boolean }[] | null;
  }[] = [];

  if (entryIds.length > 0) {
    const [r1, r2, r3, r4] = await Promise.all([
      sections.has("machines")
        ? supabase
            .from("entry_group_snapshots")
            .select(
              "entry_id, quarters_collected, dollars, turns, machine_groups(name, store_numbers, display_order)"
            )
            .in("entry_id", entryIds)
        : Promise.resolve({ data: [] }),
      sections.has("vending")
        ? supabase
            .from("vending_totals")
            .select("entry_id, cash_collected, coins_collected, vending_machines(name)")
            .in("entry_id", entryIds)
        : Promise.resolve({ data: [] }),
      sections.has("deposits")
        ? supabase
            .from("deposits")
            .select("entry_id, deposit_amount, deposit_slip_photo_path")
            .in("entry_id", entryIds)
        : Promise.resolve({ data: [] }),
      sections.has("checklist")
        ? supabase
            .from("checklist_completions")
            .select("entry_id, signed_by, signed_date, items_snapshot")
            .in("entry_id", entryIds)
        : Promise.resolve({ data: [] }),
    ]);
    snaps = (r1.data ?? []) as typeof snaps;
    vend = (r2.data ?? []) as typeof vend;
    deposits = (r3.data ?? []) as typeof deposits;
    checklists = (r4.data ?? []) as typeof checklists;
  }

  const sortedSnaps = [...snaps].sort((a, b) => {
    const byD = byDate(a.entry_id, b.entry_id);
    if (byD !== 0) return byD;
    const mgA = Array.isArray(a.machine_groups) ? a.machine_groups[0] : a.machine_groups;
    const mgB = Array.isArray(b.machine_groups) ? b.machine_groups[0] : b.machine_groups;
    return (mgA?.display_order ?? 0) - (mgB?.display_order ?? 0);
  });
  const sortedVend = [...vend].sort((a, b) => byDate(a.entry_id, b.entry_id));
  const sortedDeposits = [...deposits].sort((a, b) => byDate(a.entry_id, b.entry_id));
  const sortedChecklists = [...checklists].sort((a, b) => byDate(a.entry_id, b.entry_id));

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 print:bg-white">
      <AppHeader
        title="Export report"
        fullName={profile.fullName}
        role={profile.role}
        activeTab="dashboard"
      />

      <div className="mx-auto max-w-3xl space-y-6 p-4">
        <div className="flex items-center justify-between print:hidden">
          <Link href="/dashboard/export" className="text-sm text-blue-600 hover:underline">
            ← Back to export
          </Link>
          <PrintButton />
        </div>

        <div className="text-center">
          <h1 className="text-xl font-semibold text-neutral-900">Cypress Laundry</h1>
          <p className="text-sm text-neutral-500">
            {from} to {to}
          </p>
        </div>

        {!entries || entries.length === 0 ? (
          <p className="text-center text-sm text-neutral-500">No entries found in that range.</p>
        ) : (
          <>
            {sections.has("summary") && (
              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <h2 className="mb-3 font-semibold text-neutral-900">Summary</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Employee</th>
                      <th className="pb-2 text-right font-medium">Days</th>
                      <th className="pb-2 text-right font-medium">Income</th>
                      <th className="pb-2 text-right font-medium">Avg turns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => {
                      const p = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
                      return (
                        <tr key={e.id} className="border-t border-neutral-100">
                          <td className="py-1.5 whitespace-nowrap text-neutral-800">{e.date}</td>
                          <td className="py-1.5 text-neutral-600">{p?.full_name ?? "—"}</td>
                          <td className="py-1.5 text-right text-neutral-600">
                            {e.days_since_last}
                          </td>
                          <td className="py-1.5 text-right text-neutral-600">
                            {formatMoney(Number(e.total_income ?? 0))}
                          </td>
                          <td className="py-1.5 text-right text-neutral-600">
                            {e.avg_turns ? Number(e.avg_turns).toFixed(1) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}

            {sections.has("machines") && (
              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <h2 className="mb-3 font-semibold text-neutral-900">Machine groups</h2>
                {sortedSnaps.length === 0 ? (
                  <p className="text-sm text-neutral-500">No data in this range.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-neutral-500">
                        <th className="pb-2 pr-2 font-medium">Date</th>
                        <th className="border-l border-neutral-200 pb-2 pr-2 pl-2 font-medium">
                          Group
                        </th>
                        <th className="border-l border-neutral-200 pb-2 pl-2 text-left font-medium">
                          Quarters
                        </th>
                        <th className="border-l border-neutral-200 pb-2 pl-3 text-left font-medium">
                          $
                        </th>
                        <th className="border-l border-neutral-200 pb-2 pl-3 text-left font-medium">
                          Turns
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSnaps.map((s, i) => {
                        const mg = Array.isArray(s.machine_groups)
                          ? s.machine_groups[0]
                          : s.machine_groups;
                        return (
                          <tr key={i} className="border-t border-neutral-100">
                            <td className="py-1.5 pr-2 whitespace-nowrap text-neutral-800">
                              {dateOf.get(s.entry_id)}
                            </td>
                            <td className="border-l border-neutral-200 py-1.5 pr-2 pl-2 text-neutral-600">
                              {mg?.store_numbers && (
                                <span className="font-semibold">#{mg.store_numbers} · </span>
                              )}
                              {mg?.name}
                            </td>
                            <td className="border-l border-neutral-200 py-1.5 pl-2 text-left whitespace-nowrap text-neutral-600">
                              {s.quarters_collected}
                            </td>
                            <td className="border-l border-neutral-200 py-1.5 pl-3 text-left whitespace-nowrap text-neutral-600">
                              {formatMoney(Number(s.dollars ?? 0))}
                            </td>
                            <td className="border-l border-neutral-200 py-1.5 pl-3 text-left whitespace-nowrap text-neutral-600">
                              {Number(s.turns ?? 0).toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {sections.has("vending") && (
              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <h2 className="mb-3 font-semibold text-neutral-900">Vending</h2>
                {sortedVend.length === 0 ? (
                  <p className="text-sm text-neutral-500">No data in this range.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-neutral-500">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Machine</th>
                        <th className="pb-2 text-right font-medium">Cash</th>
                        <th className="pb-2 text-right font-medium">Coins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedVend.map((v, i) => {
                        const vm = Array.isArray(v.vending_machines)
                          ? v.vending_machines[0]
                          : v.vending_machines;
                        return (
                          <tr key={i} className="border-t border-neutral-100">
                            <td className="py-1.5 whitespace-nowrap text-neutral-800">
                              {dateOf.get(v.entry_id)}
                            </td>
                            <td className="py-1.5 text-neutral-600">{vm?.name}</td>
                            <td className="py-1.5 text-right text-neutral-600">
                              {formatMoney(Number(v.cash_collected ?? 0))}
                            </td>
                            <td className="py-1.5 text-right text-neutral-600">
                              {formatMoney(Number(v.coins_collected ?? 0))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {sections.has("deposits") && (
              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <h2 className="mb-3 font-semibold text-neutral-900">Bank deposits</h2>
                {sortedDeposits.length === 0 ? (
                  <p className="text-sm text-neutral-500">No data in this range.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-neutral-500">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 text-right font-medium">Amount</th>
                        <th className="pb-2 text-right font-medium">Slip on file</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedDeposits.map((d, i) => (
                        <tr key={i} className="border-t border-neutral-100">
                          <td className="py-1.5 whitespace-nowrap text-neutral-800">
                            {dateOf.get(d.entry_id)}
                          </td>
                          <td className="py-1.5 text-right text-neutral-600">
                            {formatMoney(Number(d.deposit_amount ?? 0))}
                          </td>
                          <td className="py-1.5 text-right text-neutral-600">
                            {d.deposit_slip_photo_path ? "Yes" : "No"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {sections.has("checklist") && (
              <section className="rounded-xl border border-neutral-200 bg-white p-4">
                <h2 className="mb-3 font-semibold text-neutral-900">Checklist</h2>
                {sortedChecklists.length === 0 ? (
                  <p className="text-sm text-neutral-500">No data in this range.</p>
                ) : (
                  <div className="space-y-4">
                    {sortedChecklists.map((c, i) => (
                      <div key={i} className="border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0">
                        <p className="mb-1 text-sm font-medium text-neutral-800">
                          {dateOf.get(c.entry_id)} — signed by {c.signed_by} on {c.signed_date}
                        </p>
                        <ul className="space-y-0.5 text-sm text-neutral-600">
                          {(c.items_snapshot ?? []).map((item, j) => (
                            <li key={j}>
                              {item.checked ? "✅" : "⬜"} {item.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
