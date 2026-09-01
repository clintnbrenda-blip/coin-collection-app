"use client";

import { deleteChecklistItem } from "./actions";

export function DeleteChecklistItemButton({ id }: { id: string }) {
  return (
    <form
      action={async (formData: FormData) => {
        if (!confirm("Permanently delete this checklist item? This cannot be undone.")) {
          return;
        }

        const result = await deleteChecklistItem(formData);
        if (result.error) {
          alert(result.error);
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </form>
  );
}
