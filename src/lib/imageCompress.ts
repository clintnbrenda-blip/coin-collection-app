/**
 * Shrinks a photo in the browser before upload: longest side capped at
 * `maxSide` px, re-encoded as JPEG. Phone cameras produce 3-8 MB photos, but
 * a form submission (Server Action) has a hard body-size cap (~4.5 MB on
 * Vercel), and a couple of full-size photos would blow straight past it.
 * 1600 px is plenty to read a deposit slip or count sheet.
 *
 * Never throws: if anything fails (unsupported format, old browser) the
 * original file is returned unchanged.
 */
export async function compressImage(
  file: File,
  maxSide = 1600,
  quality = 0.75
): Promise<File> {
  try {
    if (!file.type.startsWith("image/")) return file;

    // imageOrientation: "from-image" applies the EXIF rotation so phone photos
    // don't come out sideways after re-encoding.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    // Keep the original if re-encoding somehow made it bigger (tiny images).
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
