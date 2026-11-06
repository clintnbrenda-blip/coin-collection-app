// Server-side helpers for photos attached to a collection entry (stored in the
// private `entry-photos` bucket, one row per photo in `photos`, kind "other" —
// deposit slips use kind "deposit_slip" and are handled separately).

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const MAX_ENTRY_PHOTOS = 4;
const FIELD_PREFIX = "collection_photo_";

/** Image files submitted under collection_photo_* fields, capped at `limit`. */
export function collectPhotoFiles(formData: FormData, limit: number): File[] {
  if (limit <= 0) return [];
  return [...formData.entries()]
    .filter(([key, value]) => key.startsWith(FIELD_PREFIX) && value instanceof File)
    .map(([, value]) => value as File)
    .filter((f) => f.size > 0 && f.type.startsWith("image/"))
    .slice(0, limit);
}

/**
 * Uploads files and records them. Stops at the first failure. Always returns
 * the storage paths that DID get uploaded so the caller can clean them up
 * (discardUploadedPhotos) if it decides to abandon the operation.
 */
export async function uploadEntryPhotos(
  supabase: Supabase,
  entryId: string,
  files: File[]
): Promise<{ paths: string[]; error: string | null }> {
  const paths: string[] = [];
  for (const [i, photo] of files.entries()) {
    const ext =
      (photo.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
    const path = `${entryId}/collection-${Date.now()}-${i}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("entry-photos")
      .upload(path, photo, { contentType: photo.type });
    if (uploadError) return { paths, error: "Could not upload a photo. Try again." };
    paths.push(path);

    const { error: rowError } = await supabase
      .from("photos")
      .insert({ entry_id: entryId, storage_path: path, kind: "other" });
    if (rowError) return { paths, error: "Could not save a photo. Try again." };
  }
  return { paths, error: null };
}

/** Removes uploaded files and their rows (e.g. after a failed save). */
export async function discardUploadedPhotos(supabase: Supabase, paths: string[]) {
  if (paths.length === 0) return;
  await supabase.from("photos").delete().in("storage_path", paths);
  await supabase.storage.from("entry-photos").remove(paths);
}

/** Collection photos for an entry, with short-lived signed URLs (null if signing failed). */
export async function getEntryPhotos(
  supabase: Supabase,
  entryId: string
): Promise<{ id: string; url: string | null }[]> {
  const { data: rows } = await supabase
    .from("photos")
    .select("id, storage_path")
    .eq("entry_id", entryId)
    .eq("kind", "other")
    .order("uploaded_at", { ascending: true });
  if (!rows || rows.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from("entry-photos")
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      3600
    );
  return rows.map((r) => ({
    id: r.id,
    url: signed?.find((s) => s.path === r.storage_path)?.signedUrl ?? null,
  }));
}
