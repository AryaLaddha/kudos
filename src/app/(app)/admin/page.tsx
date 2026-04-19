import { requireAdmin } from "@/lib/auth";
import AdminDashboardClient from "@/components/app/AdminDashboardClient";
import { getAdminAnalytics } from "@/app/(app)/sprints/actions";
import { GOALS } from "@/lib/goals";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function AdminPage() {
  await requireAdmin();

  const { sprints, projects, participants, orgUsers, userGoals, recognitions } = await getAdminAnalytics();

  const supabase = await createClient();
  const { data: dbGoals } = await supabase
    .from("goals")
    .select("*");
  
  const goalDefinitions = [...GOALS, ...(dbGoals || [])];

  // Supabase infers to-one joins as arrays — normalise profile to single object
  // Also guard against null scores/project_allocations and drop orphaned rows (deleted user)
  const normalisedParticipants = participants
    .map((p) => ({
      ...p,
      profile: (Array.isArray(p.profile) ? p.profile[0] : p.profile) as Profile | null,
      scores: (p.scores ?? {}) as Record<string, number>,
      project_allocations: (p.project_allocations ?? {}) as Record<string, number>,
    }))
    .filter((p) => p.profile != null) as (typeof participants[number] & { profile: Profile; scores: Record<string, number>; project_allocations: Record<string, number> })[];

  return (
    <AdminDashboardClient
      sprints={sprints}
      projects={projects}
      participants={normalisedParticipants}
      orgUsers={orgUsers}
      userGoals={userGoals}
      goalDefinitions={goalDefinitions}
      recognitions={recognitions}
    />
  );
}
