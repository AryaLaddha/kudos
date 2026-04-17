"use server";

import { createClient } from "@/lib/supabase/server";
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
