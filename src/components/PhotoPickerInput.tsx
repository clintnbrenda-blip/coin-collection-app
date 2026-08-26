"use client";

import { useEffect, useRef, useState } from "react";

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
}: {
  name: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
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

  // Always release the camera when it's no longer shown, or on unmount.
  useEffect(() => {
    if (!cameraOpen && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOpen]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      // Some Android browsers don't honor the `autoPlay` attribute reliably
      // when srcObject is assigned programmatically — force playback
      // explicitly (this is exactly why the preview was showing black).
      video.play().catch(() => {
        // Autoplay can still be rejected in rare cases; the Capture button
        // stays disabled via videoWidth===0 checks either way.
      });
    }
  }, [cameraOpen]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
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
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });

        if (inputRef.current) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          inputRef.current.files = dataTransfer.files;
        }

        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(file);
        });
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
