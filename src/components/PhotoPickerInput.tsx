"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Two explicit buttons instead of relying on the phone/browser's default file
 * picker (which shows different, sometimes single-option, menus depending on
 * OS/browser): "Choose photo" opens the gallery/library, "Take photo" opens
 * the camera directly. Both drive the same underlying file input, so only
 * one file ever gets submitted under `name`. Shows a thumbnail of whatever
 * was picked.
 */
export function PhotoPickerInput({
  name,
  label,
}: {
  name: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Revoke the previous object URL whenever it's replaced or the component
  // unmounts, so we don't leak memory across repeated selections.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function openPicker(useCamera: boolean) {
    const input = inputRef.current;
    if (!input) return;
    if (useCamera) {
      input.setAttribute("capture", "environment");
    } else {
      input.removeAttribute("capture");
    }
    input.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-neutral-700">{label}</label>
      )}
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openPicker(false)}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Choose photo
        </button>
        <button
          type="button"
          onClick={() => openPicker(true)}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Take photo
        </button>
      </div>
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- transient local blob: URL, not worth Next's Image pipeline
        <img
          src={previewUrl}
          alt="Selected photo preview"
          className="mt-2 h-32 w-full rounded-lg border border-neutral-200 object-cover"
        />
      )}
    </div>
  );
}
