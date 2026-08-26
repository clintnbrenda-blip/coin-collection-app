"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

// Wrapped in Suspense per Next's requirement for useSearchParams in a client
// component — this just surfaces the "your reset link expired" message that
// /auth/confirm redirects here with, if the recovery link was bad.
function LinkErrorNotice() {
  const params = useSearchParams();
  const error = params.get("error");
  if (!error) return null;
  return (
    <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">
      {error}
    </p>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <Image
          src="/brand/cypress-laundry-logo.png"
          alt="Cypress Laundry"
          width={2912}
          height={1331}
          priority
          className="mx-auto mb-6 h-auto w-56"
        />
        <p className="mb-8 text-center text-sm text-neutral-500">
          Sign in to log a collection or view reports.
        </p>

        <Suspense fallback={null}>
          <LinkErrorNotice />
        </Suspense>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-neutral-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-neutral-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-base font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-500">
          <Link href="/forgot-password" className="text-blue-600 hover:underline">
            Forgot your password?
          </Link>
        </p>
      </div>
    </div>
  );
}
