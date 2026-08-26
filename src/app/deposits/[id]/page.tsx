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
  const { data: entry } = await supabase
    .from("collection_entries")
    .select("id, date")
    .eq("id", id)
    .maybeSingle();

  if (!entry) notFound();

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
