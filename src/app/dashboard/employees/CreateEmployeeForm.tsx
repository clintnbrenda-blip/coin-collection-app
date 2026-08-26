"use client";

import { useActionState } from "react";
import { createEmployee, type CreateEmployeeState } from "./actions";

const initialState: CreateEmployeeState = {
  error: null,
  createdEmail: null,
};

export function CreateEmployeeForm() {
  const [state, formAction, pending] = useActionState(createEmployee, initialState);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap gap-2">
        <input
          name="full_name"
          placeholder="Full name"
          required
          className="flex-1 rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="flex-1 rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Sending invite…" : "Send invite"}
        </button>
      </form>

      {state.error && (
        <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>
      )}

      {state.createdEmail && (
        <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          <p className="font-medium">Invite sent to {state.createdEmail}.</p>
          <p className="mt-1 text-xs text-green-700">
            They&apos;ll get an email with a link to set their own password and get started.
          </p>
        </div>
      )}
    </div>
  );
}
