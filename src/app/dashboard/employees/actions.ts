"use server";

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
  tempPassword: string | null;
}

function generateTempPassword(): string {
  // Readable-ish random password the owner relays directly to the employee.
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
    return { error: "Name and email are required.", createdEmail: null, tempPassword: null };
  }

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    return { error: error.message, createdEmail: null, tempPassword: null };
  }

  revalidatePath("/dashboard/employees");
  return { error: null, createdEmail: email, tempPassword };
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
