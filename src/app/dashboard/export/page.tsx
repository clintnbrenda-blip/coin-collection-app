import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { ExportForm } from "./ExportForm";

export default async function ExportPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/entry/new");

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader
        title="Export data"
        fullName={profile.fullName}
        role={profile.role}
        activeTab="dashboard"
      />

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to dashboard
        </Link>

        <p className="text-xs text-neutral-500">
          Pick any date range — a single day up to a full year or more — choose what to
          include, and download it as a spreadsheet or a printable PDF.
        </p>

        <ExportForm />
      </div>
    </div>
  );
}
