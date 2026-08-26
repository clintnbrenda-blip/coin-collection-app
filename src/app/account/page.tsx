import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function AccountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader title="My Account" fullName={profile.fullName} role={profile.role} />

      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Change password</h2>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
