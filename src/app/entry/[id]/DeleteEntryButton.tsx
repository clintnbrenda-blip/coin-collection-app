"use client";

import { deleteEntry } from "./actions";

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  return (
    <form
      action={async () => {
        if (confirm("Delete this entry? This cannot be undone.")) {
          await deleteEntry(entryId);
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </form>
  );
}
