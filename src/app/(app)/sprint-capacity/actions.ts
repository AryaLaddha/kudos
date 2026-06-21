"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GoalAssignment, SprintGoal, Stream } from "@/types";

const GOAL_SELECT = "*, subtasks:goal_subtasks(*), delays:goal_delays(*)";

interface SprintCapacityListItem {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "active" | "completed";
  sprint_participants: { count: number }[];
}

interface CapacityParticipant {
  id: string;
  sprint_id: string;
  user_id: string;
  base_points: number;
  scores: Record<string, number>;
  goal_allocations: Record<string, number>;
  expected_override: number | null;
  role: string | null;
  stream_ids: string[];
  profile: { id: string; full_name: string; avatar_url: string | null; job_title?: string | null };
}

async function requireOrgMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) throw new Error("Forbidden");

  return { supabase: createAdminClient(), orgId: profile.org_id as string };
}

function sortGoalChildren(goal: SprintGoal) {
  goal.subtasks?.sort((a, b) => a.created_at.localeCompare(b.created_at));
  goal.delays?.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return goal;
}

async function selectGoalsForSprint(
  supabase: Awaited<ReturnType<typeof requireOrgMember>>["supabase"],
  orgId: string,
  sprintId: string,
  sprint: { start_date: string; end_date: string },
): Promise<SprintGoal[]> {
  const [{ data: attached }, { data: overlapping }] = await Promise.all([
    supabase
      .from("sprint_goals")
      .select(GOAL_SELECT)
      .eq("org_id", orgId)
      .eq("sprint_id", sprintId),
    supabase
      .from("sprint_goals")
      .select(GOAL_SELECT)
      .eq("org_id", orgId)
      .lte("start_date", sprint.end_date)
      .gte("end_date", sprint.start_date),
  ]);

  const byId = new Map<string, SprintGoal>();
  for (const goal of [...((attached as SprintGoal[]) ?? []), ...((overlapping as SprintGoal[]) ?? [])]) {
    byId.set(goal.id, sortGoalChildren(goal));
  }
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getActiveSprintCapacityList(): Promise<SprintCapacityListItem[]> {
  const { supabase, orgId } = await requireOrgMember();
  const { data } = await supabase
    .from("sprints")
    .select("id, name, start_date, end_date, status, sprint_participants(count)")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("start_date", { ascending: false });

  return (data as SprintCapacityListItem[]) ?? [];
}

export async function getSprintCapacityReadModel(sprintId: string): Promise<{
  sprint: { id: string; name: string; start_date: string; end_date: string; status: "active" | "completed" } | null;
  participants: CapacityParticipant[];
  orgUsers: { id: string; full_name: string; avatar_url: string | null; job_title?: string | null }[];
  goals: SprintGoal[];
  streams: Stream[];
  assignments: GoalAssignment[];
}> {
  const { supabase, orgId } = await requireOrgMember();

  const { data: sprint } = await supabase
    .from("sprints")
    .select("id, name, start_date, end_date, status")
    .eq("id", sprintId)
    .eq("org_id", orgId)
    .eq("status", "active")
    .single();
  if (!sprint) {
    return { sprint: null, participants: [], orgUsers: [], goals: [], streams: [], assignments: [] };
  }

  const [{ data: participants }, { data: orgUsers }, goals, { data: streams }, { data: assignments }] = await Promise.all([
    supabase
      .from("sprint_participants")
      .select("*, profile:profiles(id, full_name, avatar_url, job_title)")
      .eq("sprint_id", sprintId),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, job_title")
      .eq("org_id", orgId)
      .order("full_name"),
    selectGoalsForSprint(supabase, orgId, sprintId, sprint),
    supabase
      .from("streams")
      .select("id, name, is_archived")
      .eq("org_id", orgId)
      .order("name"),
    supabase
      .from("goal_assignments")
      .select("*")
      .eq("org_id", orgId)
      .eq("sprint_id", sprintId),
  ]);

  const sortedParticipants = ((participants as CapacityParticipant[]) ?? []).sort((a, b) =>
    a.profile.full_name.localeCompare(b.profile.full_name),
  );

  return {
    sprint,
    participants: sortedParticipants,
    orgUsers: orgUsers ?? [],
    goals,
    streams: (streams as Stream[]) ?? [],
    assignments: (assignments as GoalAssignment[]) ?? [],
  };
}
