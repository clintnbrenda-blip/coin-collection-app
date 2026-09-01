"use client";

import { deleteChecklistItem } from "./actions";

export function DeleteChecklistItemButton({ id, itemKey }: { id: string; itemKey: string }) {
  return (
    <form
      action={async (formData: FormData) => {
        if (
          !confirm(
            "Permanently delete this checklist item? This cannot be undone."
          )
        ) {
          return;
        }

        let result = await deleteChecklistItem(formData);

        // Blocked specifically because it's used on a real entry — the one
        // case the owner might deliberately want to override. A second,
        // more explicit confirmation spells out exactly what that costs
        // before actually forcing it through.
        if (result.error && result.blockedByUsage) {
          const proceed = confirm(
            `${result.error}\n\nDelete it anyway?`
          );
          if (!proceed) return;

          const retryData = new FormData();
          retryData.set("id", id);
          retryData.set("key", itemKey);
          retryData.set("force", "true");
          result = await deleteChecklistItem(retryData);
        }

        if (result.error) {
          alert(result.error);
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="key" value={itemKey} />
      <button
        type="submit"
        className="rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </form>
  );
}
