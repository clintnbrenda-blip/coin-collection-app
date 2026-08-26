"use client";

import { useEffect } from "react";
import { clearDraftIfJustSubmitted } from "@/lib/entryDraft";

// Only actually clears the saved draft if a submit was just in flight (see
// entryDraft.ts) — so simply viewing an old entry from the dashboard never
// wipes an in-progress draft sitting on /entry/new.
export function ClearDraftOnMount() {
  useEffect(() => {
    clearDraftIfJustSubmitted();
  }, []);
  return null;
}
