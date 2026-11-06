"use client";

import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/imageCompress";

/**
 * "Choose photo" opens the standard file/gallery picker. "Take photo" opens
 * an in-page live camera view (via getUserMedia) instead of using
 * `<input capture>` — that attribute triggers a memory-constrained inline
 * capture mode that crashes with "unable to complete due to low memory" on
 * real devices (confirmed on both iOS and a Motorola/Android phone),
 * especially with modern high-resolution cameras. Capturing a frame
 * ourselves via getUserMedia + canvas avoids that OS code path entirely.
 * Both paths end up populating the same hidden file input, so only one file
 * ever gets submitted under `name`. Shows a thumbnail of whatever was picked.
 */
export function PhotoPickerInput({
  name,
  label,
  initialFile,
  onFileChange,
}: {
  name: string;
  label?: string;
  /** Pre-fill with a photo (e.g. one restored from a saved draft). Read once on mount. */
  initialFile?: File | null;
  /** Called whenever the photo is picked, replaced, or removed. */
  onFileChange?: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const currentFileRef = useRef<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Revoke the previous object URL whenever it's replaced or the component
  // unmounts, so we don't leak memory across repeated selections.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Release the camera only on an explicit close (Cancel / after capture) or
  // on unmount — NOT on every `cameraOpen` change. An earlier version had a
  // second effect keyed on `cameraOpen` whose cleanup also called
  // `stopStream()`; because both effects shared that dependency, React ran
  // this effect's stale cleanup (from the false-render) immediately after
  // `openCamera()` flipped `cameraOpen` to true, which stopped the
  // brand-new stream's tracks (via the live `streamRef.current`, since refs
  // aren't snapshotted in closures) before the video element ever attached
  // it. That's what produced a permanently black preview even after
  // permission was granted. Splitting "stop" out to only fire on unmount and
  // from `closeCamera()` removes that race entirely.
  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => stopStream();
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      // Some Android browsers don't honor the `autoPlay` attribute reliably
      // when srcObject is assigned programmatically — force playback
      // explicitly.
      video.play().catch(() => {
        // Autoplay can still be rejected in rare cases; the Capture button
        // stays disabled via videoWidth===0 checks either way.
      });
    }
  }, [cameraOpen]);

  function setInputFile(file: File | null) {
    const input = inputRef.current;
    if (!input) return;
    const dataTransfer = new DataTransfer();
    if (file) dataTransfer.items.add(file);
    input.files = dataTransfer.files;
  }

  // Single place that records "this is the photo now": remembers it, shows
  // the preview, and tells the parent (e.g. to save it as a draft).
  function applyFile(file: File | null) {
    currentFileRef.current = file;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    onFileChange?.(file);
  }

  // Pre-fill from a restored draft, once, on mount.
  useEffect(() => {
    if (!initialFile) return;
    setInputFile(initialFile);
    currentFileRef.current = initialFile;
    // Syncing in a restored file from outside React on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewUrl(URL.createObjectURL(initialFile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React resets a <form action={...}> after the action finishes, even when it
  // returned an error, which empties every file input. Put the photo back
  // right after the reset so a failed submit doesn't silently drop it while
  // the thumbnail is still showing.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setTimeout(() => setInputFile(currentFileRef.current), 0);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) {
      applyFile(null);
      return;
    }
    // Shrink before upload — full-size phone photos exceed the form's size cap.
    const file = await compressImage(picked);
    if (file !== picked) setInputFile(file);
    applyFile(file);
  }

  function removePhoto() {
    setInputFile(null);
    applyFile(null);
  }

  async function openCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setCameraError("Could not access the camera — use Choose photo instead.");
    }
  }

  function closeCamera() {
    stopStream();
    setCameraOpen(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const raw = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        const file = await compressImage(raw);
        setInputFile(file);
        applyFile(file);
        closeCamera();
      },
      "image/jpeg",
      0.9
    );
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
          onClick={() => inputRef.current?.click()}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Choose photo
        </button>
        <button
          type="button"
          onClick={openCamera}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Take photo
        </button>
      </div>

      {cameraError && <p className="mt-1 text-xs text-red-600">{cameraError}</p>}

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- transient local blob: URL, not worth Next's Image pipeline
        <img
          src={previewUrl}
          alt="Selected photo preview"
          className="mt-2 h-32 w-full rounded-lg border border-neutral-200 object-cover"
        />
      )}
      {previewUrl && (
        <button
          type="button"
          onClick={removePhoto}
          className="mt-1 text-xs text-neutral-500 underline"
        >
          Remove photo
        </button>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="flex-1 bg-black object-contain"
          />
          <div className="flex justify-center gap-4 bg-black p-4 pb-8">
            <button
              type="button"
              onClick={closeCamera}
              className="rounded-lg border border-neutral-500 px-5 py-2.5 text-sm font-medium text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white"
            >
              Capture
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
