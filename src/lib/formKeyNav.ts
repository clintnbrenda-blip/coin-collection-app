import type { KeyboardEvent } from "react";

/**
 * Attach to a <form>'s onKeyDown. Makes Enter move focus to the next field
 * instead of submitting the form early — otherwise Enter in any input
 * (e.g. moving between quarters fields) prematurely submits with whatever
 * was filled in so far, landing on the confirmation page showing zeros for
 * everything not yet reached.
 */
export function focusNextFieldOnEnter(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter") return;

  const target = e.target as HTMLElement;
  // Let the real submit button and multi-line fields behave normally.
  if (target instanceof HTMLButtonElement && target.type === "submit") return;
  if (target instanceof HTMLTextAreaElement) return;

  e.preventDefault();

  const focusable = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), button[type="submit"]:not([disabled])'
    )
  );
  const next = focusable[focusable.indexOf(target) + 1];
  next?.focus();
}
