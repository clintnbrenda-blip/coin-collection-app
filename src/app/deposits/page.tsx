import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";

export default async function DepositsListPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: pending, error } = await supabase.rpc("entries_pending_deposit");

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader
        title="Bank Deposits"
        fullName={profile.fullName}
        role={profile.role}
        activeTab="deposits"
      />

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <p className="text-sm text-neutral-500">
          Any collection still waiting on a bank deposit shows up here — anyone can submit
          one, not just whoever did the collection.
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Could not load pending deposits.
          </p>
        )}

        {!error && (!pending || pending.length === 0) && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
            Nothing waiting on a deposit right now.
          </div>
        )}

        <div className="space-y-2">
          {(pending ?? []).map((entry: { id: string; date: string }) => (
            <Link
              key={entry.id}
              href={`/deposits/${entry.id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 hover:bg-neutral-50"
            >
              <span className="font-medium text-neutral-800">{entry.date}</span>
              <span className="text-sm text-blue-600">Submit deposit →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
