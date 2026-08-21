"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export interface ChangePasswordState {
  error: string | null;
  success: boolean;
}

export async function changeOwnPassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters.", success: false };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords don't match.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: error.message, success: false };
  }

  return { error: null, success: true };
}
