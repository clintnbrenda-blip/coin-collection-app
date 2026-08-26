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
     * - public assets (svg, png, jpg, etc.)
     * (there used to be an /auth/* exclusion here for a server-side PKCE
     * callback route — removed along with that route; every password-link
     * flow is now handled client-side at /set-password instead, see
     * src/lib/supabase/implicit.ts for why)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
