import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ResetPasswordForm } from "./ResetPasswordForm";

// A server component wrapper (rather than putting the auth check only in
// resetPassword's server action) so this route is forced into dynamic
// rendering and always re-checked per request — a page with zero server data
// fetching of its own gets statically prerendered, which meant the
// middleware's login-redirect wasn't consistently re-evaluating it on every
// request the way it does for every other protected page in this app.
export default async function ResetPasswordPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return <ResetPasswordForm />;
}
