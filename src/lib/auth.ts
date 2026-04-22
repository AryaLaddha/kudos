import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// ── Scoped permission allowlists ──────────────────────────────────────────────
// Admins always have all permissions. These lists grant specific access to
// non-admin users without making them full admins.
const USER_MANAGERS  = ["arya.laddha@scape.com.au"];
const SPRINT_MANAGERS = ["angelica.chavez@scape.com.au"];

async function getCurrentUserEmail(): Promise<{ email: string | null; isAdmin: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { email: null, isAdmin: false };

  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return { email: user.email ?? null, isAdmin: data?.is_admin === true };
}

/**
 * Returns true if the currently authenticated user is an org admin.
 */
export async function isAdmin(): Promise<boolean> {
  const { isAdmin } = await getCurrentUserEmail();
  return isAdmin;
}

/**
 * Returns true if the user can access user management
 * (full admins or explicitly listed emails).
 */
export async function canManageUsers(): Promise<boolean> {
  const { email, isAdmin } = await getCurrentUserEmail();
  if (isAdmin) return true;
  return email !== null && USER_MANAGERS.includes(email);
}

/**
 * Returns true if the user can access sprints
 * (full admins or explicitly listed emails).
 */
export async function canManageSprints(): Promise<boolean> {
  const { email, isAdmin } = await getCurrentUserEmail();
  if (isAdmin) return true;
  return email !== null && SPRINT_MANAGERS.includes(email);
}

/**
 * Guards a server component or action — redirects to /feed if the caller
 * is not an admin.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/feed");
}

/**
 * Guards the user management page.
 */
export async function requireUserManager(): Promise<void> {
  if (!(await canManageUsers())) redirect("/feed");
}

/**
 * Guards the sprints page.
 */
export async function requireSprintManager(): Promise<void> {
  if (!(await canManageSprints())) redirect("/feed");
}
