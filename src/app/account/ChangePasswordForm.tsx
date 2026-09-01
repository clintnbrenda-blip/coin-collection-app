"use client";

import { useActionState } from "react";
import { changeOwnPassword, type ChangePasswordState } from "./actions";
import { PasswordInput } from "@/components/PasswordInput";

const initialState: ChangePasswordState = { error: null, success: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPassword, initialState);

  if (state.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
        <p className="font-medium text-green-900">✅ Password changed</p>
        <p className="mt-1 text-sm text-green-700">
          Use your new password the next time you log in.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          New password
        </label>
        <PasswordInput
          name="new_password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
        />
        <p className="mt-1 text-xs text-neutral-500">At least 8 characters.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Confirm new password
        </label>
        <PasswordInput
          name="confirm_password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
