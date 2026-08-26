import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (static files)
     * - favicon.ico
     * - the PWA manifest and service worker — these must be fetchable by the
     *   browser with NO auth cookie at all (that's how installability checks
     *   and service-worker registration work), so redirecting them to
     *   /login like every other route was silently serving login-page HTML
     *   in place of the manifest/worker, breaking "Install app" entirely
     * - /auth/* (the password-reset link callback) — it must run regardless
     *   of current auth state (no session yet, or an unrelated existing
     *   session on that device) so it can always perform the token exchange
     *   itself; letting the normal login-redirect logic touch it first would
     *   swallow the one-time reset code before the route handler ever saw it
     * - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|auth/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
