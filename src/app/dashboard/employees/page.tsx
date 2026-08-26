import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { setActive, setRole } from "./actions";
import { CreateEmployeeForm } from "./CreateEmployeeForm";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { ResendInviteButton } from "./ResendInviteButton";

export default async function EmployeesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/entry/new");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader title="Employee Accounts" fullName={profile.fullName} role={profile.role} activeTab="dashboard" />

      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to dashboard
        </Link>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Accounts</h2>
          <div className="space-y-2">
            {(profiles ?? []).map((p) => (
              <div
                key={p.id}
                className={`rounded-lg border p-3 ${
                  p.active ? "border-neutral-200" : "border-neutral-100 bg-neutral-50 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-800">{p.full_name}</p>
                    <p className="text-xs text-neutral-400">
                      {p.role} {!p.active && "· deactivated"}
                    </p>
                  </div>

                  {p.id !== profile.id && (
                    <>
                      <form action={setRole}>
                        <input type="hidden" name="id" value={p.id} />
                        <input
                          type="hidden"
                          name="role"
                          value={p.role === "owner" ? "employee" : "owner"}
                        />
                        <button
                          type="submit"
                          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                        >
                          Make {p.role === "owner" ? "employee" : "owner"}
                        </button>
                      </form>
                      <form action={setActive}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value={(!p.active).toString()} />
                        <button
                          type="submit"
                          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                        >
                          {p.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    </>
                  )}
                  {p.id === profile.id && (
                    <span className="text-xs text-neutral-400">(you)</span>
                  )}
                </div>

                {p.id !== profile.id && (
                  <div className="mt-2 flex flex-wrap gap-2 border-t border-neutral-100 pt-2">
                    <ResendInviteButton userId={p.id} />
                    <ResetPasswordButton userId={p.id} fullName={p.full_name} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Add an employee</h2>
          <CreateEmployeeForm />
        </section>
      </div>
    </div>
  );
}
