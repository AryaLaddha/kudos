import { requireAdmin } from "@/lib/auth";
import AdminDashboardClient from "@/components/app/AdminDashboardClient";
import { getAdminAnalytics } from "@/app/(app)/sprints/actions";
import { GOALS } from "@/lib/goals";
import type { Profile } from "@/types";

export default async function AdminPage() {
  await requireAdmin();

  const { sprints, projects, participants, orgUsers, userGoals, recognitions } = await getAdminAnalytics();

  // Supabase infers to-one joins as arrays — normalise profile to single object
  const normalisedParticipants = participants.map((p) => ({
    ...p,
    profile: (Array.isArray(p.profile) ? p.profile[0] : p.profile) as Profile,
  }));

  return (
    <AdminDashboardClient
      sprints={sprints}
      projects={projects}
      participants={normalisedParticipants}
      orgUsers={orgUsers}
      userGoals={userGoals}
      goalDefinitions={GOALS}
      recognitions={recognitions}
    />
  );
}
