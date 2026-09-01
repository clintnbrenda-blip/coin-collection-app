import type { ChecklistItemSnapshot } from "@/lib/supabase/types";

// Checklist items live in the `checklist_items` table now (see migration
// 0009 and /dashboard/checklist) — the owner edits wording/sections himself
// instead of needing a code change. This file just keeps the shared type and
// a small helper both submit actions use.
export interface ChecklistItem {
  key: string;
  section: string;
  text: string;
}

/**
 * Reads which checklist boxes were checked directly off the submitted
 * FormData (any `checklist_<key>` field with value "on"), rather than
 * needing to already know the full valid key list. This means the two
 * submit actions (new entry, edit entry) don't need their own DB round-trip
 * just to figure out which keys are legitimate — whatever checkboxes the
 * form actually rendered (active items, plus any retired-but-previously-
 * checked one carried forward on edit) is exactly what gets saved.
 */
export function getCheckedChecklistKeys(formData: FormData): string[] {
  const prefix = "checklist_";
  const keys: string[] = [];
  for (const [name, value] of formData.entries()) {
    if (name.startsWith(prefix) && value === "on") {
      keys.push(name.slice(prefix.length));
    }
  }
  return keys;
}

/** Groups a flat item list by section, preserving each section's first-seen order. */
export function groupChecklistItems<T extends ChecklistItem>(items: T[]): [string, T[]][] {
  const groups = items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});
  return Object.entries(groups);
}

/**
 * Freezes exactly what a submission's checklist looked like, independent of
 * whatever checklist_items contains later — the whole point being that
 * editing, retiring, or deleting an item afterward can never change what an
 * already-submitted entry displays. Same idea as entry_group_snapshots'
 * qty_at_time/price_at_time for machine groups.
 */
export function buildChecklistSnapshot(
  items: ChecklistItem[],
  checkedKeys: string[]
): ChecklistItemSnapshot[] {
  return items.map((item) => ({
    section: item.section,
    text: item.text,
    checked: checkedKeys.includes(item.key),
  }));
}
