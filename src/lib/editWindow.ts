export const EDIT_WINDOW_MS = 60 * 60 * 1000;

/** True if `createdAt` (ISO timestamp) is still within the 1-hour employee edit window. */
export function isWithinEditWindow(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS;
}
