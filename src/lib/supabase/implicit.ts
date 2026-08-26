import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// A client dedicated to triggering password-recovery-style emails that must
// be completable on a DIFFERENT device than the one that requested them.
//
// @supabase/ssr's createServerClient/createBrowserClient hard-code
// `flowType: "pkce"` with no way to override it (verified directly in
// their source — it's spread in after the caller's own options). PKCE
// stores a code_verifier in the REQUESTING browser's cookies, so a link
// generated that way can only ever be completed on that same browser —
// which breaks the owner inviting/resetting an employee from the owner's
// own session (the employee opens the email on their own device), and even
// breaks plain self-service resets whenever someone requests on one device
// and opens their email on another (extremely common in practice).
//
// This plain, stateless client uses `flowType: "implicit"` instead — the
// resulting link carries its session tokens directly in the URL, valid on
// whatever device opens it. Completed via src/app/set-password, the same
// way genuine invite links already work.
export function createImplicitFlowClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false } }
  );
}
