"use client";

import { useState } from "react";
import { PhotoPickerInput } from "@/components/PhotoPickerInput";

/**
 * A short list of photo slots, each one a normal PhotoPickerInput (choose or
 * take photo). Starts with one slot; "Add another photo" appends more up to
 * `max`. Each slot submits under `${name}_${n}` — the server action collects
 * every field whose name starts with `${name}_`. Empty slots submit nothing.
 */
export function MultiPhotoPicker({ name, max = 4 }: { name: string; max?: number }) {
  // Stable ids (not array indexes) so removing/adding never remounts a slot
  // that already holds a photo.
  const [slots, setSlots] = useState<number[]>([0]);
  const [nextId, setNextId] = useState(1);

  return (
    <div className="space-y-4">
      {slots.map((id, i) => (
        <div key={id}>
          <PhotoPickerInput
            name={`${name}_${id}`}
            label={slots.length > 1 ? `Photo ${i + 1}` : undefined}
          />
          {slots.length > 1 && (
            <button
              type="button"
              onClick={() => setSlots((s) => s.filter((x) => x !== id))}
              className="mt-1 text-xs text-neutral-500 underline"
            >
              Remove this photo
            </button>
          )}
        </div>
      ))}

      {slots.length < max && (
        <button
          type="button"
          onClick={() => {
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
