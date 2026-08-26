"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${protocol}://${host}/auth/confirm?next=/reset-password`,
  });

  // Always report success, whether or not that email is actually registered
  // — telling the difference would let someone probe which emails have
  // accounts.
  return { error: null, success: true };
}
