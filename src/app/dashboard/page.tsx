import { redirect } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { resolveDateRange, type Period } from "@/lib/dateRanges";
import { ExportCsvButton } from "./ExportCsvButton";
import { PrintButton } from "./PrintButton";
import { GroupFilterSelect } from "./GroupFilterSelect";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
    group?: string;
    target?: string;
  }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/entry/new");

  const sp = await searchParams;
  const period = (sp.period as Period) || "month";
  const range = resolveDateRange(period, sp.from, sp.to, sp.target);
  const groupFilter = sp.group || "";
  // Carries the group filter (and nothing else) onto links that change period/target.
  const groupQS = groupFilter ? `&group=${groupFilter}` : "";

  const supabase = await createClient();

  const { data: location } = await supabase
    .from("locations")
    .select("id")
    .limit(1)
    .single();

  const { data: machineGroups } = await supabase
    .from("machine_groups")
    .select("id, name, type, display_order")
    .order("display_order", { ascending: true });

  const { data: entries } = await supabase
    .from("collection_entries")
    .select(
      "id, date, days_since_last, total_income, avg_turns, income_per_day, profiles(full_name)"
    )
    .eq("location_id", location?.id ?? "")
    .gte("date", range.from)
    .lte("date", range.to)
    .order("date", { ascending: false });

  const entryIds = (entries ?? []).map((e) => e.id);

  const { data: snapshots } = entryIds.length
    ? await supabase
        .from("entry_group_snapshots")
        .select("entry_id, machine_group_id, quarters_collected, dollars, turns, machine_groups(name, type)")
        .in("entry_id", entryIds)
    : { data: [] };

  const { data: vendingRows } = entryIds.length
    ? await supabase
        .from("vending_totals")
        .select("entry_id, vending_machine_id, cash_collected, coins_collected, vending_machines(name)")
        .in("entry_id", entryIds)
    : { data: [] };

  const { data: depositRows } = entryIds.length
    ? await supabase.from("deposits").select("deposit_amount").in("entry_id", entryIds)
    : { data: [] };

  // ---- Aggregates ----
  const machineIncome = (snapshots ?? []).reduce((sum, s) => sum + Number(s.dollars ?? 0), 0);

  const vendingByEntry = new Map<string, number>();
  for (const v of vendingRows ?? []) {
    const amount = Number(v.cash_collected ?? 0) + Number(v.coins_collected ?? 0);
    vendingByEntry.set(v.entry_id, (vendingByEntry.get(v.entry_id) ?? 0) + amount);
  }
  const vendingIncome = [...vendingByEntry.values()].reduce((s, v) => s + v, 0);

  const vendingByMachine = new Map<string, { name: string; total: number }>();
  for (const v of vendingRows ?? []) {
    const vm = Array.isArray(v.vending_machines) ? v.vending_machines[0] : v.vending_machines;
    const key = v.vending_machine_id;
    const entry = vendingByMachine.get(key) ?? { name: vm?.name ?? "?", total: 0 };
    entry.total += Number(v.cash_collected ?? 0) + Number(v.coins_collected ?? 0);
    vendingByMachine.set(key, entry);
  }
  const vendingByMachineRows = [...vendingByMachine.values()].sort((a, b) => b.total - a.total);

  const depositsTotal = (depositRows ?? []).reduce((s, d) => s + Number(d.deposit_amount ?? 0), 0);

  const combinedIncome = machineIncome + vendingIncome;

  const totalDays = (entries ?? []).reduce((s, e) => s + Number(e.days_since_last ?? 0), 0);
  const incomePerDayAvg = totalDays > 0 ? combinedIncome / totalDays : 0;

  // per-machine-group avg turns for the period (avg of turns where quarters > 0)
  const groupTurns = new Map<string, { name: string; turnsSum: number; count: number }>();
  for (const s of snapshots ?? []) {
    if (groupFilter && s.machine_group_id !== groupFilter) continue;
    if (Number(s.quarters_collected) <= 0) continue;
    const mg = getMg(s);
    const key = s.machine_group_id;
    const entry = groupTurns.get(key) ?? { name: mg?.name ?? "?", turnsSum: 0, count: 0 };
    entry.turnsSum += Number(s.turns ?? 0);
    entry.count += 1;
    groupTurns.set(key, entry);
  }
  const groupTurnsRows = [...groupTurns.values()]
    .map((g) => ({ name: g.name, avgTurns: g.turnsSum / g.count }))
    .sort((a, b) => b.avgTurns - a.avgTurns);

  const overallAvgTurns =
    groupTurnsRows.length > 0
      ? groupTurnsRows.reduce((s, g) => s + g.avgTurns, 0) / groupTurnsRows.length
      : 0;

  // Monthly breakdown — lets the owner drill from a year/quarter down into one month.
  interface MonthAgg {
    key: string;
    label: string;
    income: number;
    turnsSum: number;
    turnsCount: number;
    entryCount: number;
  }
  const monthMap = new Map<string, MonthAgg>();
  for (const e of entries ?? []) {
    const key = e.date.slice(0, 7); // YYYY-MM
    const agg = monthMap.get(key) ?? {
      key,
      label: format(parseISO(`${key}-01`), "MMMM yyyy"),
      income: 0,
      turnsSum: 0,
      turnsCount: 0,
      entryCount: 0,
    };
    agg.income += Number(e.total_income ?? 0) + (vendingByEntry.get(e.id) ?? 0);
    agg.entryCount += 1;
    if (e.avg_turns) {
      agg.turnsSum += Number(e.avg_turns);
      agg.turnsCount += 1;
    }
    monthMap.set(key, agg);
  }
  const monthRows = [...monthMap.values()]
    .map((m) => ({ ...m, avgTurns: m.turnsCount ? m.turnsSum / m.turnsCount : 0 }))
    .sort((a, b) => b.key.localeCompare(a.key));

  const logRows = (entries ?? []).map((e) => {
    const emp = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    return {
      id: e.id,
      date: e.date,
      employee: emp?.full_name ?? "—",
      daysSinceLast: e.days_since_last,
      totalIncome: Number(e.total_income ?? 0),
      avgTurns: e.avg_turns ? Number(e.avg_turns) : null,
      incomePerDay: e.income_per_day ? Number(e.income_per_day) : null,
    };
  });

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 print:bg-white">
      <AppHeader title="Dashboard" fullName={profile.fullName} />

      <div className="mx-auto max-w-4xl space-y-6 p-4">
        {/* Filters */}
        <form className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4 print:hidden">
          <div className="flex gap-1.5">
            {(["month", "quarter", "year", "custom"] as Period[]).map((p) => (
              <Link
                key={p}
                href={`/dashboard?period=${p}${groupQS}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  period === p
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {p[0].toUpperCase() + p.slice(1)}
              </Link>
            ))}
          </div>

          {period === "custom" && (
            <div className="flex items-end gap-2">
              <div>
                <label className="mb-1 block text-xs text-neutral-500">From</label>
                <input
                  type="date"
                  name="from"
                  defaultValue={range.from}
                  className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">To</label>
                <input
                  type="date"
                  name="to"
                  defaultValue={range.to}
                  className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </div>
              <input type="hidden" name="period" value="custom" />
              <button
                type="submit"
                className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white"
              >
                Apply
              </button>
            </div>
          )}

          <div className="ml-auto">
            <label className="mb-1 block text-xs text-neutral-500">Machine group</label>
            <GroupFilterSelect groups={machineGroups ?? []} value={groupFilter} />
          </div>
        </form>

        <p className="text-sm text-neutral-500">{range.label} · {range.from} to {range.to}</p>

        {/* Hero stats — income and turns get equal top billing */}
        <section className="grid grid-cols-2 gap-3">
          <HeroCard label="Total income" value={`$${combinedIncome.toFixed(2)}`} />
          <HeroCard label="Avg turns" value={overallAvgTurns.toFixed(2)} />
        </section>

        <section className="grid grid-cols-3 gap-3">
          <SummaryCard label="Vending income" value={`$${vendingIncome.toFixed(2)}`} />
          <SummaryCard label="Bank deposits" value={`$${depositsTotal.toFixed(2)}`} />
          <SummaryCard label="Avg income/day" value={`$${incomePerDayAvg.toFixed(2)}`} />
        </section>

        {/* Monthly breakdown — click a month to drill into its detail */}
        {period !== "month" && monthRows.length > 0 && (
          <section className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-neutral-900">By month</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 text-right font-medium">Income</th>
                  <th className="pb-2 text-right font-medium">Avg turns</th>
                  <th className="pb-2 text-right font-medium">Visits</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((m) => (
                  <tr key={m.key} className="border-t border-neutral-100">
                    <td className="py-1.5">
                      <Link
                        href={`/dashboard?period=month&target=${m.key}-01${groupQS}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {m.label}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right text-neutral-600">${m.income.toFixed(2)}</td>
                    <td className="py-1.5 text-right text-neutral-600">{m.avgTurns.toFixed(2)}</td>
                    <td className="py-1.5 text-right text-neutral-600">{m.entryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Turns by machine group */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">
              Turns by machine group {groupFilter ? "(filtered)" : ""}
            </h2>
            <span className="text-sm text-neutral-500">
              Overall avg: {overallAvgTurns.toFixed(2)}
            </span>
          </div>
          {groupTurnsRows.length === 0 ? (
            <p className="text-sm text-neutral-500">No data for this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="pb-2 font-medium">Group</th>
                  <th className="pb-2 text-right font-medium">Avg turns/day</th>
                </tr>
              </thead>
              <tbody>
                {groupTurnsRows.map((g) => (
                  <tr key={g.name} className="border-t border-neutral-100">
                    <td className="py-1.5 text-neutral-800">{g.name}</td>
                    <td className="py-1.5 text-right text-neutral-600">
                      {g.avgTurns.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Vending by machine */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Vending by machine</h2>
          {vendingByMachineRows.length === 0 ? (
            <p className="text-sm text-neutral-500">No data for this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="pb-2 font-medium">Machine</th>
                  <th className="pb-2 text-right font-medium">Income</th>
                </tr>
              </thead>
              <tbody>
                {vendingByMachineRows.map((v) => (
                  <tr key={v.name} className="border-t border-neutral-100">
                    <td className="py-1.5 text-neutral-800">{v.name}</td>
                    <td className="py-1.5 text-right text-neutral-600">${v.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Collection log */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between print:hidden">
            <h2 className="font-semibold text-neutral-900">Collection log</h2>
            <div className="flex gap-2">
              <ExportCsvButton rows={logRows} filename={`collection-log-${range.from}-to-${range.to}.csv`} />
              <PrintButton />
            </div>
          </div>
          {logRows.length === 0 ? (
            <p className="text-sm text-neutral-500">No entries for this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Employee</th>
                  <th className="pb-2 text-right font-medium">Days</th>
                  <th className="pb-2 text-right font-medium">Income</th>
                  <th className="pb-2 text-right font-medium">Avg turns</th>
                  <th className="pb-2 text-right font-medium">Income/day</th>
                </tr>
              </thead>
              <tbody>
                {logRows.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="py-1.5">
                      <Link href={`/entry/${r.id}`} className="text-blue-600 hover:underline">
                        {r.date}
                      </Link>
                    </td>
                    <td className="py-1.5 text-neutral-600">{r.employee}</td>
                    <td className="py-1.5 text-right text-neutral-600">{r.daysSinceLast}</td>
                    <td className="py-1.5 text-right text-neutral-600">
                      ${r.totalIncome.toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right text-neutral-600">
                      {r.avgTurns !== null ? r.avgTurns.toFixed(2) : "—"}
                    </td>
                    <td className="py-1.5 text-right text-neutral-600">
                      {r.incomePerDay !== null ? `$${r.incomePerDay.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="print:hidden">
          <Link
            href="/dashboard/machine-groups"
            className="text-sm text-blue-600 hover:underline"
          >
            Manage machine groups &amp; employees →
          </Link>
        </div>
      </div>
    </div>
  );
}

function HeroCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
      <p className="text-sm text-blue-700">{label}</p>
      <p className="text-4xl font-semibold text-blue-900">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

interface SnapshotWithGroup {
  machine_groups: { name: string; type: string } | { name: string; type: string }[] | null;
}
function getMg(s: SnapshotWithGroup) {
  return Array.isArray(s.machine_groups) ? s.machine_groups[0] : s.machine_groups;
}
