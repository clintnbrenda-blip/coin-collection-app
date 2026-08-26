"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";

async function requireOwner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") {
    throw new Error("Only the owner can manage employee accounts.");
  }
  return profile;
}

export interface CreateEmployeeState {
  error: string | null;
  createdEmail: string | null;
  resentExisting: boolean;
}

function generateTempPassword(): string {
  // Readable-ish random password the owner relays directly to the employee —
  // still used by the force-reset action below (for someone locked out of
  // both their account AND their email), just not for new-account creation
  // anymore.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createEmployee(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  await requireOwner();

  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !fullName) {
    return { error: "Name and email are required.", createdEmail: null, resentExisting: false };
  }

  // Derive the site origin from the request itself, same as the
  // forgot-password flow — this app is reachable at both the custom domain
  // and the .vercel.app one.
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    // NOT /auth/confirm — invites don't support the PKCE code-exchange flow
    // password-reset links use (the inviting browser and the accepting
    // browser are different, so Supabase can't guarantee PKCE's security
    // properties here). Invite links instead carry the session tokens in
    // the URL fragment, which only client-side JS can read — see
    // /accept-invite.
    redirectTo: `${protocol}://${host}/accept-invite`,
  });

  if (error) {
    // inviteUserByEmail refuses to re-send a "new user" invite once the
    // email already has an account — which happens the moment ANY invite
    // attempt for it succeeds, even one that never actually got completed
    // (e.g. it landed on a broken link, like the Site URL misconfiguration
    // that caused exactly this the first time around). Fall back to a
    // password-reset-style email instead, which works for existing accounts
    // and lands them on the same "set your password" experience.
    if (error.code === "email_exists" || error.code === "user_already_exists") {
      const supabase = await createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${protocol}://${host}/auth/confirm?next=/reset-password`,
      });
      if (resetError) {
        return { error: resetError.message, createdEmail: null, resentExisting: false };
      }
      revalidatePath("/dashboard/employees");
      return { error: null, createdEmail: email, resentExisting: true };
    }
    return { error: error.message, createdEmail: null, resentExisting: false };
  }

  revalidatePath("/dashboard/employees");
  return { error: null, createdEmail: email, resentExisting: false };
}

export interface ResendInviteState {
  error: string | null;
  sentTo: string | null;
}

export async function resendInvite(
  userId: string,
  _prevState: ResendInviteState,
  _formData: FormData
): Promise<ResendInviteState> {
  await requireOwner();

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";

  const admin = createAdminClient();

  // profiles has no email column (it lives on auth.users) — look it up by id
  // rather than requiring the caller to already know it.
  const { data, error: lookupError } = await admin.auth.admin.getUserById(userId);
  if (lookupError || !data.user.email) {
    return { error: "Could not find that account's email address.", sentTo: null };
  }
  const email = data.user.email;

  // Same fallback createEmployee uses for an already-registered email —
  // inviteUserByEmail only works for brand-new accounts, so a "resend" for
  // an existing (even never-activated) one goes through the password-reset
  // email instead. Same destination for the employee either way: a link to
  // set their password.
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${protocol}://${host}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    return { error: error.message, sentTo: null };
  }

  return { error: null, sentTo: email };
}

export interface ResetPasswordState {
  error: string | null;
  tempPassword: string | null;
}

export async function resetPassword(
  userId: string,
  _prevState: ResetPasswordState,
  _formData: FormData
): Promise<ResetPasswordState> {
  await requireOwner();

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });

  if (error) {
    return { error: error.message, tempPassword: null };
  }

  return { error: null, tempPassword };
}

export async function setActive(formData: FormData) {
  await requireOwner();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  await supabase.from("profiles").update({ active }).eq("id", id);
  revalidatePath("/dashboard/employees");
}

export async function setRole(formData: FormData) {
  const owner = await requireOwner();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));

  if (id === owner.id) {
    throw new Error("You can't change your own role.");
  }
  if (role !== "owner" && role !== "employee") {
    throw new Error("Invalid role.");
  }

  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/dashboard/employees");
}
