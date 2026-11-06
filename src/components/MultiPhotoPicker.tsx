"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoPickerInput } from "@/components/PhotoPickerInput";
import { deletePhotoDraft, loadPhotoDrafts, savePhotoDraft } from "@/lib/photoDraft";

/**
 * A short list of photo slots, each one a normal PhotoPickerInput (choose or
 * take photo). Starts with one slot; "Add another photo" appends more up to
 * `max`. Each slot submits under `${name}_${n}` — the server action collects
 * every field whose name starts with `${name}_`. Empty slots submit nothing.
 *
 * `persistScope` turns on draft saving: photos are kept in this device's
 * IndexedDB as they're picked and restored when the form is opened again
 * (see lib/photoDraft.ts). Pass the same scope string the text draft uses so
 * both go stale together. Leave it off (e.g. the edit form) for no drafts.
 * Clearing saved photos after a successful submit is done elsewhere
 * (clearDraftIfJustSubmitted in lib/entryDraft.ts).
 */
export function MultiPhotoPicker({
  name,
  max = 4,
  persistScope,
}: {
  name: string;
  max?: number;
  persistScope?: string;
}) {
  // Stable ids (not array indexes) so removing/adding never remounts a slot
  // that already holds a photo.
  const [slots, setSlots] = useState<number[]>([0]);
  const [nextId, setNextId] = useState(1);
  const [restored, setRestored] = useState<Record<number, File>>({});
  // Once the user touches the picker, a late-arriving restore must not
  // overwrite what they just did.
  const touched = useRef(false);

  useEffect(() => {
    if (!persistScope) return;
    let cancelled = false;
    loadPhotoDrafts(persistScope).then((saved) => {
      if (cancelled || touched.current || saved.length === 0) return;
      setRestored(Object.fromEntries(saved.map((r) => [r.id, r.file])));
      setSlots(saved.map((r) => r.id));
      setNextId(Math.max(...saved.map((r) => r.id)) + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [persistScope]);

  function handleFileChange(id: number, file: File | null) {
    touched.current = true;
    if (!persistScope) return;
    if (file) void savePhotoDraft(id, persistScope, file);
    else void deletePhotoDraft(id);
  }

  function removeSlot(id: number) {
    touched.current = true;
    setSlots((s) => s.filter((x) => x !== id));
    if (persistScope) void deletePhotoDraft(id);
  }

  return (
    <div className="space-y-4">
      {slots.map((id, i) => (
        // A slot that gets a restored photo remounts (new key) so the picker
        // can pre-fill itself from it on mount.
        <div key={restored[id] ? `restored-${id}` : id}>
          <PhotoPickerInput
            name={`${name}_${id}`}
            label={slots.length > 1 ? `Photo ${i + 1}` : undefined}
            initialFile={restored[id] ?? null}
            onFileChange={(file) => handleFileChange(id, file)}
          />
          {slots.length > 1 && (
            <button
              type="button"
              onClick={() => removeSlot(id)}
              className="mt-1 text-xs text-neutral-500 underline"
            >
              Remove this slot
            </button>
          )}
        </div>
      ))}

      {slots.length < max && (
        <button
          type="button"
          onClick={() => {
            touched.current = true;
            setSlots((s) => [...s, nextId]);
            setNextId((n) => n + 1);
          }}
          className="w-full rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          + Add another photo
        </button>
      )}
    </div>
  );
}
