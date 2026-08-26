"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export interface SubmitDepositState {
  error: string | null;
}

export async function submitDeposit(
  entryId: string,
  _prevState: SubmitDepositState,
  formData: FormData
): Promise<SubmitDepositState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const depositAmount = Number(formData.get("deposit_amount") ?? 0) || 0;

  let depositSlipPath: string | null = null;
  const photo = formData.get("deposit_slip_photo") as File | null;
  if (photo && photo.size > 0) {
    const ext = photo.name.split(".").pop() || "jpg";
    const path = `${entryId}/deposit-slip-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("entry-photos")
      .upload(path, photo, { contentType: photo.type });
    if (uploadError) {
      return { error: "Could not upload the deposit slip photo. Try again." };
    }
    depositSlipPath = path;
    await supabase
      .from("photos")
      .insert({ entry_id: entryId, storage_path: path, kind: "deposit_slip" });
  }

  const { error } = await supabase.from("deposits").upsert(
    {
      entry_id: entryId,
      deposit_amount: depositAmount,
      ...(depositSlipPath ? { deposit_slip_photo_path: depositSlipPath } : {}),
    },
    { onConflict: "entry_id" }
  );

  if (error) {
    return { error: "Could not save the deposit. Try again." };
  }

  revalidatePath("/deposits");
  redirect("/deposits/submitted");
}
