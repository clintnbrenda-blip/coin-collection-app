// Local-only draft storage for the new-entry form's photos, in this device's
// IndexedDB. (localStorage can't hold photos: too small, and text-only.)
// Same idea and lifetime as entryDraft.ts: kept on the phone, never sent
// anywhere until a real Submit, cleared once a submission succeeds.
//
// Each photo is saved already shrunk (see imageCompress.ts), as raw bytes
// rather than a File/Blob, which is the most reliable thing to store across
// phone browsers. Every record carries the `scope` (the newest-entry id the
// draft was started against, same value entryDraft.ts uses) so photos left
// over from an already-submitted entry are recognised as stale and dropped.
//
// Everything here swallows errors: private browsing or full storage just
// means photos don't survive a reload; the form itself keeps working.

const DB_NAME = "coin-app";
const STORE = "photo-drafts";

interface PhotoRecord {
  id: number; // slot id within the picker
  scope: string;
  name: string;
  type: string;
  bytes: ArrayBuffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      })
  );
}

export async function savePhotoDraft(id: number, scope: string, file: File) {
  try {
    const bytes = await file.arrayBuffer();
    const record: PhotoRecord = { id, scope, name: file.name, type: file.type, bytes };
    await run("readwrite", (s) => s.put(record));
  } catch {
    // ignore
  }
}

export async function deletePhotoDraft(id: number) {
  try {
    await run("readwrite", (s) => s.delete(id));
  } catch {
    // ignore
  }
}

export async function clearPhotoDrafts() {
  try {
    await run("readwrite", (s) => s.clear());
  } catch {
    // ignore
  }
}

/**
 * Saved photos for this scope, oldest slot first. Records from any other
 * scope are stale and get deleted on the way through.
 */
export async function loadPhotoDrafts(
  scope: string
): Promise<{ id: number; file: File }[]> {
  try {
    const all = (await run("readonly", (s) => s.getAll())) as PhotoRecord[];
    const mine = all.filter((r) => r.scope === scope);
    if (mine.length !== all.length) {
      for (const stale of all.filter((r) => r.scope !== scope)) {
        await deletePhotoDraft(stale.id);
      }
    }
    return mine
      .sort((a, b) => a.id - b.id)
      .map((r) => ({
        id: r.id,
        file: new File([r.bytes], r.name, { type: r.type }),
      }));
  } catch {
    return [];
  }
}
