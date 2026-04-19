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
}): Promise<{ error?: string; setupLink?: string }> {
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

  // 2. Insert or update the profile row 
  // (In case the handle_new_user trigger silently failed to insert the profile, we UPSERT it here)
  if (created?.user?.id) {
    await adminClient
      .from("profiles")
      .upsert({
        id: created.user.id,
        org_id: adminProfile.org_id,
        full_name: full_name ?? "",
        ...(department ? { department } : {}),
        ...(job_title ? { job_title } : {}),
      });
  }

  // 3. Generate a setup link.
  // We return this to the frontend so the admin can copy and share it directly.
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000");

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: email,
    options: {
      redirectTo: `${appUrl}/auth/recover`,
    }
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.warn("Could not generate setup link:", linkError?.message);
  }

  revalidatePath("/admin/users");
  return {
    setupLink: linkData?.properties?.action_link
  };
}
