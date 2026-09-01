"use client";

import { deleteChecklistItem } from "./actions";

export function DeleteChecklistItemButton({ id, itemKey }: { id: string; itemKey: string }) {
  return (
    <form
      action={async (formData: FormData) => {
        if (
          !confirm(
            "Permanently delete this checklist item? This cannot be undone. (If it's ever been checked on a submitted entry, this will be blocked automatically — retire it instead in that case.)"
          )
        ) {
          return;
        }
        const result = await deleteChecklistItem(formData);
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
