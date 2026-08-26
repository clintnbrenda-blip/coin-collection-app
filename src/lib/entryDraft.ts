// Local-only draft persistence for the new-entry form. Everything typed is
// saved to this device's browser storage as it's entered, so an interrupted
// phone (call, lock screen, backgrounded tab getting killed, flaky signal)
// doesn't lose data. Nothing here ever touches the server or the dashboard —
// only a real Submit does that. Cleared once a submission actually succeeds.
//
// Known limitation: selected photo files cannot be restored (browsers don't
// allow reading back a <input type="file">'s selection from storage for
// security reasons) — if the page truly reloads, photos need re-attaching,
// but every other field survives.

const DRAFT_KEY = "coin-app:entry-draft:v1";
const PENDING_CLEAR_KEY = "coin-app:entry-draft:pending-clear";

export interface EntryDraft {
  date: string;
  manualDays: string;
  quarters: Record<string, string>;
  vendingCash: Record<string, string>;
  vendingCoins: Record<string, string>;
  checkedItems: Record<string, boolean>;
  signedBy: string;
  signedDate: string;
}

export function loadDraft(): Partial<EntryDraft> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<EntryDraft>) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: EntryDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private browsing, storage full, etc. — form still works in-session,
    // it just won't survive a reload. Nothing to surface to the user here.
  }
}

/** Call right as the form is submitted, before we know if it'll succeed. */
export function markPendingSubmit() {
  try {
    sessionStorage.setItem(PENDING_CLEAR_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * Call on mount of the entry confirmation page. Only clears the draft if a
 * submit was actually in flight (set by markPendingSubmit) — so simply
 * browsing to view some other entry never wipes an in-progress draft.
 */
export function clearDraftIfJustSubmitted() {
  try {
    if (sessionStorage.getItem(PENDING_CLEAR_KEY) === "1") {
      localStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(PENDING_CLEAR_KEY);
    }
  } catch {
    // ignore
  }
}
