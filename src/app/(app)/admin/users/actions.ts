"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Profile } from "@/types";

export async function getOrgUsers(): Promise<(Profile & { email: string })[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, department, job_title, monthly_allowance, points_balance, is_admin, is_active, created_at")
    .eq("org_id", profile.org_id)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching org users:", error);
    return [];
  }

  // Fetch emails from auth.users via admin RPC — fall back to empty string if unavailable
  const { data: authUsers } = await supabase.rpc("get_org_user_emails", {
    p_org_id: profile.org_id,
  });

  const emailMap: Record<string, string> = {};
  if (authUsers) {
    for (const u of authUsers as { id: string; email: string }[]) {
      emailMap[u.id] = u.email;
    }
  }

  return (data as Profile[]).map(p => ({
    ...p,
    email: emailMap[p.id] ?? "",
  }));
}

export async function setUserActive(
  userId: string,
  isActive: boolean
): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorized" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_active", {
    p_user_id: userId,
    p_is_active: isActive,
  });

  if (error) {
    console.error("Error setting user active:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return {};
}

export async function setUserAdmin(
  userId: string,
  adminFlag: boolean
): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorized" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_admin", {
    p_user_id: userId,
    p_is_admin: adminFlag,
  });

  if (error) {
    console.error("Error setting user admin:", error);
    // Surface the friendly guard messages from the RPC
    if (error.message.includes("cannot_demote_self")) {
      return { error: "You cannot remove your own admin access." };
    }
    if (error.message.includes("org_mismatch")) {
      return { error: "That user is not in your organisation." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return {};
}

export async function inviteUser(formData: {
  email: string;
  full_name?: string;
  department?: string;
  job_title?: string;
}): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorized" };

  const { email, full_name, department, job_title } = formData;

  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return { error: "A valid email address is required." };
  }

  // Resolve the org_id of the calling admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!adminProfile?.org_id) return { error: "No organisation found for your account." };

  const adminClient = createAdminClient();

  // 1. Create the auth user immediately (email_confirm: true skips the
  //    confirmation step so the account is live right away).
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: full_name ?? "",
      org_id: adminProfile.org_id,
    },
  });

  if (createError) {
    console.error("Create user error:", createError);
    return { error: createError.message };
  }

  // 2. Patch the profile row (the handle_new_user trigger created a bare one).
  if (created?.user?.id) {
    await adminClient
      .from("profiles")
      .update({
        org_id: adminProfile.org_id,
        full_name: full_name ?? "",
        ...(department ? { department } : {}),
        ...(job_title  ? { job_title }  : {}),
      })
      .eq("id", created.user.id);
  }

  // 3. Send Supabase's native password-reset email.
  //    This uses the "Reset Password" template already configured in your
  //    Supabase project — no extra email provider needed.
  //    The user clicks the link, sets their own password, and is in.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("supabase.co", "vercel.app") ??
    "";

  const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/auth/reset-password`,
  });

  if (resetError) {
    // Non-fatal: user was created, they can still use "Forgot password" themselves.
    console.warn("Could not send reset email (user was still created):", resetError.message);
  }

  revalidatePath("/admin/users");
  return {};
}
