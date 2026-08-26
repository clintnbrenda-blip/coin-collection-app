import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for the link in the password-reset email. Supabase's
// resetPasswordForEmail sends the user here with a one-time `code`; exchange
// it for a real session (this sets the auth cookies) and hand off to
// /reset-password, where they're now "logged in" just long enough to set a
// new password.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("That reset link is invalid or has expired.")}`
  );
}
