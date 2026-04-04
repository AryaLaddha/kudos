import { requireAdmin } from "@/lib/auth";
import AdminDashboardClient from "@/components/app/AdminDashboardClient";
import { getAdminAnalytics } from "@/app/(app)/sprints/actions";
import { GOALS } from "@/lib/goals";

export default async function AdminPage() {
  await requireAdmin(); 

  const { sprints, projects, participants, orgUsers, userGoals, recognitions } = await getAdminAnalytics();

  return (
    <AdminDashboardClient
      sprints={sprints}
      projects={projects}
      participants={participants}
      orgUsers={orgUsers}
      userGoals={userGoals}
      goalDefinitions={GOALS}
      recognitions={recognitions}
    />
  );
}
