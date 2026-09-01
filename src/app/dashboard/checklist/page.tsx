import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { groupChecklistItems } from "@/lib/checklist";
import {
  updateChecklistItem,
  retireChecklistItem,
  reactivateChecklistItem,
  addChecklistItem,
} from "./actions";
import { DeleteChecklistItemButton } from "./DeleteChecklistItemButton";

export default async function ChecklistPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/entry/new");

  const supabase = await createClient();

  const { data: items } = await supabase
    .from("checklist_items")
    .select("id, key, section, text, active, display_order")
    .order("display_order", { ascending: true });

  const sections = [...new Set((items ?? []).map((i) => i.section))];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <AppHeader title="Checklist" fullName={profile.fullName} role={profile.role} activeTab="dashboard" />

      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to dashboard
        </Link>

        <p className="text-xs text-neutral-500">
          Changing wording here affects new entries going forward. Retiring an item keeps
          it visible on any past entry where it was already checked, but removes it from
          new collection submissions.
        </p>

        {groupChecklistItems(items ?? []).map(([section, sectionItems]) => (
          <section key={section} className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-neutral-900">{section}</h2>
            <div className="space-y-3">
              {sectionItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 ${
                    item.active
                      ? "border-neutral-200"
                      : "border-neutral-100 bg-neutral-50 opacity-60"
                  }`}
                >
                  <form action={updateChecklistItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <div className="mb-2">
                      <label className="mb-0.5 block text-xs text-neutral-500">Section</label>
                      <input
                        type="text"
                        name="section"
                        list="checklist-sections"
                        defaultValue={item.section}
                        disabled={!item.active}
                        required
                        className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="mb-0.5 block text-xs text-neutral-500">Text</label>
                      <textarea
                        name="text"
                        defaultValue={item.text}
                        disabled={!item.active}
                        required
                        rows={2}
                        className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      {item.active && (
                        <button
                          type="submit"
                          className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Save
                        </button>
                      )}
                      <button
                        type="submit"
                        formAction={item.active ? retireChecklistItem : reactivateChecklistItem}
                        className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                      >
                        {item.active ? "Retire" : "Reactivate"}
                      </button>
                    </div>
                  </form>
                  {!item.active && (
                    <div className="mt-2 flex justify-end border-t border-neutral-200 pt-2">
                      <DeleteChecklistItemButton id={item.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">Add a checklist item</h2>
          <form action={addChecklistItem} className="space-y-2">
            <div>
              <label className="mb-0.5 block text-xs text-neutral-500">Section</label>
              <input
                type="text"
                name="section"
                list="checklist-sections"
                placeholder="e.g. Money changers"
                required
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-neutral-500">Text</label>
              <textarea
                name="text"
                placeholder="What should be checked?"
                required
                rows={2}
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white"
            >
              Add
            </button>
          </form>
        </section>

        <datalist id="checklist-sections">
          {sections.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
