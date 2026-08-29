import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  updateMachineGroup,
  retireMachineGroup,
  reactivateMachineGroup,
  addMachineGroup,
  addVendingMachine,
  retireVendingMachine,
  reactivateVendingMachine,
} from "./actions";

export default async function MachineGroupsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/entry/new");

  const supabase = await createClient();

  const { data: machineGroups } = await supabase
    .from("machine_groups")
    .select("id, name, type, qty, price, store_numbers, active, display_order")
    .order("display_order", { ascending: true });

  const { data: vendingMachines } = await supabase
    .from("vending_machines")
    .select("id, name, active, display_order")
    .order("display_order", { ascending: true });

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader title="Machine Groups" fullName={profile.fullName} role={profile.role} activeTab="dashboard" />

      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to dashboard
        </Link>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-1 font-semibold text-neutral-900">Washers &amp; Dryers</h2>
          <p className="mb-3 text-xs text-neutral-500">
            Changing qty/price only affects entries from now on — past entries keep the values
            that were active when they were submitted.
          </p>
          <div className="space-y-3">
            {(machineGroups ?? []).map((mg) => (
              <form
                key={mg.id}
                action={updateMachineGroup}
                className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 ${
                  mg.active ? "border-neutral-200" : "border-neutral-100 bg-neutral-50 opacity-60"
                }`}
              >
                <input type="hidden" name="id" value={mg.id} />
                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-medium text-neutral-800">{mg.name}</p>
                  <p className="text-xs text-neutral-400">{mg.type}</p>
                </div>
                <div>
                  <label className="mb-0.5 block text-xs text-neutral-500">Store #</label>
                  <input
                    type="text"
                    name="store_numbers"
                    placeholder="e.g. 2-5"
                    defaultValue={mg.store_numbers ?? ""}
                    disabled={!mg.active}
                    className="w-28 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs text-neutral-500">Qty</label>
                  <input
                    type="number"
                    name="qty"
                    min="1"
                    defaultValue={mg.qty}
                    disabled={!mg.active}
                    className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs text-neutral-500">Price</label>
                  <input
                    type="number"
                    name="price"
                    step="0.01"
                    min="0.01"
                    defaultValue={mg.price}
                    disabled={!mg.active}
                    className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  />
                </div>
                {mg.active ? (
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Save
                  </button>
                ) : null}
                <button
                  type="submit"
                  formAction={mg.active ? retireMachineGroup : reactivateMachineGroup}
                  className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  {mg.active ? "Retire" : "Reactivate"}
                </button>
              </form>
            ))}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer select-none text-sm text-blue-600">
              + Add a machine group
            </summary>
            <form action={addMachineGroup} className="mt-3 grid grid-cols-2 gap-2">
              <input
                name="name"
                placeholder="Name"
                required
                className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <select name="type" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
                <option value="washer">Washer</option>
                <option value="dryer">Dryer</option>
              </select>
              <input
                name="qty"
                type="number"
                min="1"
                placeholder="Qty"
                required
                className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <input
                name="store_numbers"
                placeholder="Store # (e.g. 2-5)"
                className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <input
                name="price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Price"
                required
                className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="col-span-2 rounded-md bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white"
              >
                Add
              </button>
            </form>
          </details>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Vending machines</h2>
          <div className="space-y-2">
            {(vendingMachines ?? []).map((vm) => (
              <form
                key={vm.id}
                action={vm.active ? retireVendingMachine : reactivateVendingMachine}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  vm.active ? "border-neutral-200" : "border-neutral-100 bg-neutral-50 opacity-60"
                }`}
              >
                <input type="hidden" name="id" value={vm.id} />
                <span className="text-sm text-neutral-800">{vm.name}</span>
                <button
                  type="submit"
                  className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  {vm.active ? "Retire" : "Reactivate"}
                </button>
              </form>
            ))}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer select-none text-sm text-blue-600">
              + Add a vending machine
            </summary>
            <form action={addVendingMachine} className="mt-3 flex gap-2">
              <input
                name="name"
                placeholder="Name"
                required
                className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white"
              >
                Add
              </button>
            </form>
          </details>
        </section>

        <Link href="/dashboard/employees" className="text-sm text-blue-600 hover:underline">
          Manage employee accounts →
        </Link>
      </div>
    </div>
  );
}
