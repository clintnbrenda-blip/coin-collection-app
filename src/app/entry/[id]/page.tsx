import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { CHECKLIST_ITEMS } from "@/lib/checklist";
import { isWithinEditWindow } from "@/lib/editWindow";
import { DeleteEntryButton } from "./DeleteEntryButton";

export default async function EntryDetailPage({
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
    .select(
      "id, date, days_since_last, total_income, avg_turns, income_per_day, employee_id, created_at"
    )
    .eq("id", id)
    .single();

  if (!entry) notFound();

  const isOwner = profile.role === "owner";
  const isMine = entry.employee_id === profile.id;
  if (!isOwner && !isMine) notFound();

  const withinEditWindow = isWithinEditWindow(entry.created_at);
  const canEdit = isOwner || (isMine && withinEditWindow);

  const [{ data: snapshots }, { data: vendingRows }, { data: deposit }, { data: checklist }] =
    await Promise.all([
      supabase
        .from("entry_group_snapshots")
        .select("id, quarters_collected, dollars, turns, machine_groups(name, type, display_order)")
        .eq("entry_id", id),
      supabase
        .from("vending_totals")
        .select("cash_collected, coins_collected, vending_machines(name)")
        .eq("entry_id", id),
      supabase.from("deposits").select("*").eq("entry_id", id).maybeSingle(),
      supabase
        .from("checklist_completions")
        .select("*")
        .eq("entry_id", id)
        .maybeSingle(),
    ]);

  const sortedSnapshots = [...(snapshots ?? [])].sort((a, b) => {
    const mgA = Array.isArray(a.machine_groups) ? a.machine_groups[0] : a.machine_groups;
    const mgB = Array.isArray(b.machine_groups) ? b.machine_groups[0] : b.machine_groups;
    return (mgA?.display_order ?? 0) - (mgB?.display_order ?? 0);
  });

  const vendingTotal = (vendingRows ?? []).reduce(
    (sum, v) => sum + Number(v.cash_collected ?? 0) + Number(v.coins_collected ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader title="Collection Entry" fullName={profile.fullName} />

      <div className="mx-auto max-w-2xl space-y-6 p-4">
        {isOwner ? (
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
            <p className="text-sm text-blue-700">Total income (machines)</p>
            <p className="text-3xl font-semibold text-blue-900">
              ${(entry.total_income ?? 0).toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-blue-700">
              {entry.date} · {entry.days_since_last} day
              {Number(entry.days_since_last) === 1 ? "" : "s"} since last · avg turns{" "}
              {entry.avg_turns ? Number(entry.avg_turns).toFixed(2) : "—"}
            </p>
          </section>
        ) : (
          <section className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <p className="text-2xl font-semibold text-green-900">✅ Submitted</p>
            <p className="mt-1 text-sm text-green-700">Collection entry saved for {entry.date}.</p>
          </section>
        )}

        {/* Employees just need the confirmation above — the full breakdown
            below is owner-only reporting detail. */}
        {isOwner && (
          <>
            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="mb-3 font-semibold text-neutral-900">By machine group</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="pb-2 font-medium">Group</th>
                    <th className="pb-2 text-right font-medium">Quarters</th>
                    <th className="pb-2 text-right font-medium">$</th>
                    <th className="pb-2 text-right font-medium">Turns</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSnapshots.map((s) => {
                    const mg = Array.isArray(s.machine_groups)
                      ? s.machine_groups[0]
                      : s.machine_groups;
                    return (
                      <tr key={s.id} className="border-t border-neutral-100">
                        <td className="py-1.5 text-neutral-800">{mg?.name}</td>
                        <td className="py-1.5 text-right text-neutral-600">
                          {s.quarters_collected}
                        </td>
                        <td className="py-1.5 text-right text-neutral-600">
                          ${Number(s.dollars ?? 0).toFixed(2)}
                        </td>
                        <td className="py-1.5 text-right text-neutral-600">
                          {Number(s.turns ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="mb-2 font-semibold text-neutral-900">Vending</h2>
              <ul className="space-y-1 text-sm text-neutral-600">
                {vendingRows?.map((v, i) => {
                  const vm = Array.isArray(v.vending_machines)
                    ? v.vending_machines[0]
                    : v.vending_machines;
                  return (
                    <li key={i}>
                      {vm?.name}: cash ${Number(v.cash_collected ?? 0).toFixed(2)} + coins $
                      {Number(v.coins_collected ?? 0).toFixed(2)}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-sm font-medium text-neutral-800">
                Total: ${vendingTotal.toFixed(2)}
              </p>
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="mb-2 font-semibold text-neutral-900">Bank deposit</h2>
              <p className="text-sm text-neutral-600">
                ${Number(deposit?.deposit_amount ?? 0).toFixed(2)}
                {deposit?.deposit_slip_photo_path ? " · slip photo attached" : " · no slip photo"}
              </p>
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="mb-2 font-semibold text-neutral-900">Checklist</h2>
              {checklist ? (
                <>
                  <ul className="space-y-1 text-sm text-neutral-600">
                    {CHECKLIST_ITEMS.map((item) => (
                      <li key={item.key}>
                        {checklist.checked_items.includes(item.key) ? "✅" : "⬜"}{" "}
                        {item.text}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-neutral-500">
                    Signed by {checklist.signed_by} on {checklist.signed_date}
                  </p>
                </>
              ) : (
                <p className="text-sm text-neutral-500">No checklist recorded.</p>
              )}
            </section>
          </>
        )}

        <div className="flex gap-3">
          <Link
            href={profile.role === "owner" ? "/dashboard" : "/entry/new"}
            className="flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            {profile.role === "owner" ? "Back to dashboard" : "New entry"}
          </Link>
          {canEdit && (
            <Link
              href={`/entry/${entry.id}/edit`}
              className="flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Edit
            </Link>
          )}
          {canEdit && <DeleteEntryButton entryId={entry.id} />}
        </div>
        {!canEdit && isMine && (
          <p className="text-center text-xs text-neutral-400">
            The 1-hour edit window for this entry has passed. Ask the owner for corrections.
          </p>
        )}
      </div>
    </div>
  );
}
