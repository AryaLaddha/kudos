import { requireAdmin } from "@/lib/auth";
import AdminDashboardClient from "@/components/app/AdminDashboardClient";
import { getAdminAnalytics } from "@/app/(app)/sprints/actions";

export default async function AdminPage() {
  await requireAdmin(); 

  const { sprints, projects, participants, orgUsers } = await getAdminAnalytics();

  return (
    <AdminDashboardClient 
      sprints={sprints}
      projects={projects}
      participants={participants}
      orgUsers={orgUsers}
    />
  );
}
