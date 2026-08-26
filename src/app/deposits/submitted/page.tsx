import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

export default async function DepositSubmittedPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader
        title="Bank Deposit"
        fullName={profile.fullName}
        role={profile.role}
        activeTab="deposits"
      />
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <section className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-2xl font-semibold text-green-900">✅ Deposit recorded</p>
        </section>
        <Link
          href="/deposits"
          className="block rounded-lg border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Back to pending deposits
        </Link>
      </div>
    </div>
  );
}
