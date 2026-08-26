"use client";

import { useActionState } from "react";
import { resendInvite, type ResendInviteState } from "./actions";

const initialState: ResendInviteState = { error: null, sentTo: null };

export function ResendInviteButton({ userId }: { userId: string }) {
  const boundAction = resendInvite.bind(null, userId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Resend invite"}
        </button>
      </form>

      {state.sentTo && (
        <p className="mt-2 rounded-lg bg-green-50 p-2.5 text-xs text-green-800">
          Sent a password-setup link to {state.sentTo}.
        </p>
      )}
      {state.error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{state.error}</p>
      )}
    </div>
  );
}
