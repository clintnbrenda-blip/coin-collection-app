import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { DepositForm } from "./DepositForm";

export default async function DepositEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  // DB function: the deposit is often submitted by a different employee than
  // the collector, and RLS hides other employees' entries from a plain query.
  const { data: entryDate } = await supabase.rpc("entry_date_for_deposit", {
    p_entry_id: id,
  });

  if (!entryDate) notFound();
  const entry = { id, date: entryDate };

  const { data: existingDeposit } = await supabase
    .from("deposits")
    .select("deposit_amount, deposit_slip_photo_path")
    .eq("entry_id", id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader
        title="Bank Deposit"
        fullName={profile.fullName}
        role={profile.role}
        activeTab="deposits"
      />
      <DepositForm
        entryId={entry.id}
        date={entry.date}
        existingAmount={existingDeposit?.deposit_amount ?? null}
        hasExistingPhoto={!!existingDeposit?.deposit_slip_photo_path}
      />
    </div>
  );
}
