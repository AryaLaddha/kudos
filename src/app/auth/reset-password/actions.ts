"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function updatePasswordWithRecoveryToken(
  tokenHash: string,
  password: string
): Promise<{ error?: string }> {
  if (!tokenHash) return { error: "This password reset link is missing a token." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery" as EmailOtpType,
  });

  if (verifyError || !data.user?.id) {
    return {
      error:
        verifyError?.message ??
        "This password reset link is invalid or has expired. Please ask your admin for a new link.",
    };
  }

  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient.auth.admin.updateUserById(data.user.id, {
    password,
    email_confirm: true,
  });

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: activateError } = await adminClient
    .from("profiles")
    .update({ is_active: true })
    .eq("id", data.user.id);

  if (activateError) {
    return { error: activateError.message };
  }

  await supabase.auth.signOut();
  return {};
}
