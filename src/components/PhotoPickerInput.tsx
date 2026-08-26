"use client";

import { useEffect, useRef, useState } from "react";

// iOS Safari has a well-documented bug where <input capture> triggers a
// memory-constrained inline capture mode that frequently fails with a
// system "unable to complete due to low memory" error, especially on
// modern high-resolution cameras. Android doesn't have this problem, so we
// only skip the direct-camera-jump behavior on iOS — there, tapping "Take
// photo" falls back to the OS's own (non-buggy) picker, which still offers
// "Take Photo" as one of its own menu options.
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as "MacIntel" but has touch support, unlike a real Mac.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Two explicit buttons instead of relying on the phone/browser's default file
 * picker (which shows different, sometimes single-option, menus depending on
 * OS/browser): "Choose photo" opens the gallery/library, "Take photo" opens
 * the camera directly (Android) or falls back to the OS's own picker (iOS,
 * to avoid a Safari camera-capture crash — see isIOS() above). Both drive the
 * same underlying file input, so only one file ever gets submitted under
 * `name`. Shows a thumbnail of whatever was picked.
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
    if (useCamera && !isIOS()) {
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
