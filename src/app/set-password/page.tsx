"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "saving" | "error" | "done";

// The universal landing page for every password-setup/reset email link —
// a genuine invite, a self-service "forgot password", or an owner
// resetting/re-inviting an employee. All of them now carry their session
// tokens in the URL fragment rather than a `?code=` query param (see
// src/lib/supabase/implicit.ts for why), which only client-side JS can
// read — so this has to be handled entirely here: read the fragment, hand
// it to the Supabase client to establish a session, then let the person set
// their password.
export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);

    // Reading the URL fragment is external-system sync (unavailable during
    // render, and gone from the URL after the first read) — an effect is the
    // correct tool here.
    const errorDescription = params.get("error_description");
    if (errorDescription) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(errorDescription.replace(/\+/g, " "));
      setStatus("invalid");
      return;
    }

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      setError("This link is missing or malformed.");
      setStatus("invalid");
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setError(sessionError.message);
          setStatus("invalid");
        } else {
          // Drop the tokens from the visible URL now that they're consumed.
          window.history.replaceState(null, "", window.location.pathname);
          setStatus("ready");
        }
      })
      .catch(() => {
        // A well-formed Supabase link never lands here — this only catches
        // a mangled/truncated URL (bad copy-paste, an email client that
        // broke the link) where the token isn't valid JWT shape at all,
        // which throws while Supabase's client tries to decode it rather
        // than resolving with the normal { error } shape above. Without
        // this, that case left the page stuck on "Checking your link…"
        // forever.
        setError("This link is missing or malformed.");
        setStatus("invalid");
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }

    setStatus("done");
    // router.refresh() re-fetches server data for the destination with the
    // brand-new session cookie setSession()/updateUser() just wrote — a
    // plain router.push() alone could serve a cached RSC payload from before
    // the session existed.
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold text-neutral-900">
          Set your password
        </h1>
        <p className="mb-8 text-center text-sm text-neutral-500">
          Choose a password for your Cypress Laundry account.
        </p>

        {status === "checking" && (
          <p className="text-center text-sm text-neutral-500">Checking your link…</p>
        )}

        {status === "invalid" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="font-medium text-red-900">This link isn&apos;t valid</p>
            <p className="mt-1 text-sm text-red-700">
              {error ?? "It may have already been used or expired."} Ask the owner to send you a
              new one.
            </p>
          </div>
        )}

        {status === "done" && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <p className="font-medium text-green-900">✅ Password set</p>
            <p className="mt-1 text-sm text-green-700">Taking you in…</p>
          </div>
        )}

        {(status === "ready" || status === "saving") && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-neutral-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-neutral-500">At least 8 characters.</p>
            </div>
            <div>
              <label
                htmlFor="confirm_password"
                className="mb-1 block text-sm font-medium text-neutral-700"
              >
                Confirm password
              </label>
              <input
                id="confirm_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-base font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {status === "saving" ? "Saving…" : "Set password & continue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
