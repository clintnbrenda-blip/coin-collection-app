"use client";

import { useActionState } from "react";
import { resetPassword, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = { error: null, tempPassword: null };

export function ResetPasswordButton({ userId, fullName }: { userId: string; fullName: string }) {
  const boundAction = resetPassword.bind(null, userId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
        >
          {pending ? "Resetting…" : "Reset password"}
        </button>
      </form>

      {state.tempPassword && (
        <div className="mt-2 rounded-lg bg-green-50 p-2.5 text-xs text-green-800">
          <p className="font-medium">New password for {fullName}:</p>
          <p className="mt-1">
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              {state.tempPassword}
            </code>
          </p>
          <p className="mt-1 text-green-700">Share it now — it won&apos;t be shown again.</p>
        </div>
      )}
      {state.error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{state.error}</p>
      )}
    </div>
  );
}
