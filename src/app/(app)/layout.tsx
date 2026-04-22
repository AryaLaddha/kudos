import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppSidebar from "@/components/app/AppSidebar";
import { canManageUsers, canManageSprints } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [{ data: profile }, userManager, sprintManager] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, org_id, full_name, avatar_url, is_admin, points_balance, monthly_allowance, department, job_title, created_at")
      .eq("id", user.id)
      .single(),
    canManageUsers(),
    canManageSprints(),
  ]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar user={user} profile={profile} canManageUsers={userManager} canManageSprints={sprintManager} />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
