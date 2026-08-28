"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageUsers } from "@/lib/auth";
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

  // Fetch emails from auth.users via the service-role client; fall back to empty strings if unavailable.
  const emailMap: Record<string, string> = {};
  const adminClient = createAdminClient();
  const { data: listedUsers, error: listedUsersError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listedUsersError) {
    console.error("Error fetching auth users:", listedUsersError);
  } else {
    const profileIds = new Set((data as Profile[]).map((p) => p.id));
    for (const u of listedUsers.users) {
      if (profileIds.has(u.id)) emailMap[u.id] = u.email ?? "";
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
  if (!(await canManageUsers())) return { error: "Not authorized" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id === userId) return { error: "You cannot deactivate your own account." };

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!callerProfile?.org_id) return { error: "No organisation found for your account." };

  const adminClient = createAdminClient();
  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .single();

  if (targetProfile?.org_id !== callerProfile.org_id) {
    return { error: "That user is not in your organisation." };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);

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
  if (!(await canManageUsers())) return { error: "Not authorized" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id === userId && !adminFlag) return { error: "You cannot remove your own admin access." };

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!callerProfile?.org_id) return { error: "No organisation found for your account." };

  const adminClient = createAdminClient();
  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .single();

  if (targetProfile?.org_id !== callerProfile.org_id) {
    return { error: "That user is not in your organisation." };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ is_admin: adminFlag })
    .eq("id", userId);

  if (error) {
    console.error("Error setting user admin:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return {};
}

export async function generateLoginLink(
  userId: string
): Promise<{ error?: string; setupLink?: string }> {
  if (!(await canManageUsers())) return { error: "Not authorized" };

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

  // Fetch the target user's email via admin API
  const { data: targetUser, error: fetchError } = await adminClient.auth.admin.getUserById(userId);
  if (fetchError || !targetUser?.user?.email) {
    return { error: "Could not find user." };
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000");

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: targetUser.user.email,
    options: {
      redirectTo: `${appUrl}/auth/recover`,
    },
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return { error: linkError?.message ?? "Could not generate link." };
  }

  // Wrap in an intermediate page so messaging apps (Slack, Teams, email)
  // don't consume the one-time Supabase token via link-preview crawling.
  const recoveryUrl = `${appUrl}/auth/reset-password?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=recovery`;
  const encoded = Buffer.from(recoveryUrl).toString("base64url");
  return { setupLink: `${appUrl}/auth/setup-account?t=${encoded}` };
}

export async function inviteUser(formData: {
  email: string;
  full_name?: string;
  department?: string;
  job_title?: string;
}): Promise<{ error?: string; setupLink?: string }> {
  if (!(await canManageUsers())) return { error: "Not authorized" };

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

  if (linkError || !linkData?.properties?.hashed_token) {
    console.warn("Could not generate setup link:", linkError?.message);
  }

  revalidatePath("/admin/users");

  const tokenHash = linkData?.properties?.hashed_token;
  const recoveryUrl = tokenHash
    ? `${appUrl}/auth/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
    : undefined;
  const wrappedLink = recoveryUrl
    ? `${appUrl}/auth/setup-account?t=${Buffer.from(recoveryUrl).toString("base64url")}`
    : undefined;

  return { setupLink: wrappedLink };
}
