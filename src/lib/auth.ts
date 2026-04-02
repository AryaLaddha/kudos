import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Returns true if the currently authenticated user is an org admin.
 * Safe to call from any server component or server action.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return data?.is_admin === true;
}

/**
 * Guards a server component or action — redirects to /feed if the caller
 * is not an admin. Call at the top of any admin-only page/action.
 */
export async function requireAdmin(): Promise<void> {
  const admin = await isAdmin();
  if (!admin) redirect("/feed");
}
