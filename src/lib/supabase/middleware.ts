import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request and redirects
// unauthenticated users to /login. Called from middleware.ts.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/forgot-password");

  // /set-password's whole job is to establish (or replace) a session from
  // the tokens in its own URL fragment — the tokens only arrive there,
  // which client-side JS reads and exchanges for a session itself (see
  // set-password/page.tsx), so the server never sees a cookie for it on
  // first arrival. It must be exempt from BOTH redirect branches below, not
  // just the "no session yet" one: someone opening the link on a shared
  // device (or the owner testing while logged in as themselves) already has
  // an unrelated session, and bouncing them to "/" before the page loads
  // would silently discard the link's tokens instead of switching to the
  // account it points at.
  const isPasswordLinkRoute = request.nextUrl.pathname.startsWith("/set-password");

  if (!user && !isAuthRoute && !isPasswordLinkRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
