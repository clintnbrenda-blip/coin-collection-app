"use server";

import { headers } from "next/headers";
import { createImplicitFlowClient } from "@/lib/supabase/implicit";

export interface RequestResetState {
  error: string | null;
  success: boolean;
}

export async function requestPasswordReset(
  _prevState: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email address.", success: false };
  }

  // Derive the site origin from the request itself rather than hardcoding
  // it — this app is reachable at both the custom domain and the .vercel.app
  // one, and this must match whichever the person is actually on.
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";

  // Uses the plain implicit-flow client, not the cookie-bound SSR one —
  // resets are routinely requested on one device and completed on another
  // (checking email on a phone after requesting from a computer). See
  // src/lib/supabase/implicit.ts for why the SSR client can't do this.
  const supabase = createImplicitFlowClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${protocol}://${host}/set-password`,
  });

  // Always report success, whether or not that email is actually registered
  // — telling the difference would let someone probe which emails have
  // accounts.
  return { error: null, success: true };
}
