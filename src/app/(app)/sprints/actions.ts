"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAdminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("is_admin, org_id").eq("id", user.id).single();
  if (!profile?.is_admin) throw new Error("Forbidden");
  return { supabase, user, orgId: profile.org_id! };
}

// ── PROJECTS ───────────────────────────────────────────────────

export async function getProjects() {
  const { supabase, orgId } = await requireAdminClient();
  const { data } = await supabase.from("projects").select("*").eq("org_id", orgId).order("name");
  return data ?? [];
}

export async function createProject(name: string) {
  const { supabase, orgId } = await requireAdminClient();
  const { error } = await supabase.from("projects").insert({ name, org_id: orgId });
  if (error) return { error: error.message };
  revalidatePath("/sprints");
  return {};
}

export async function deleteProject(id: string) {
  const { supabase } = await requireAdminClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/sprints");
  return {};
}

// ── SPRINTS ────────────────────────────────────────────────────

export async function getSprints() {
  const { supabase, orgId } = await requireAdminClient();
  const { data } = await supabase
    .from("sprints")
    .select("*, sprint_participants(count)")
    .eq("org_id", orgId)
    .order("start_date", { ascending: false });
  return data ?? [];
}

export async function createSprint(payload: {
  name: string;
  start_date: string;
  end_date: string;
  base_points: number;
}) {
  const { supabase, orgId } = await requireAdminClient();
  const { data, error } = await supabase
    .from("sprints")
    .insert({
      name: payload.name,
      start_date: payload.start_date,
      end_date: payload.end_date,
      org_id: orgId,
      columns: {
        won: [
          { id: "extra", name: "Extra Points" },
          { id: "recognition", name: "Recognition" },
          { id: "other_won", name: "Other" },
        ],
        deducted: [
          { id: "subtasks", name: "Subtasks Status" },
          { id: "bugs", name: "Bugs?" },
          { id: "documentation", name: "Documentation" },
          { id: "engagement", name: "Engagement" },
          { id: "video_cam", name: "Video Cam" },
          { id: "comms", name: "Comms" },
          { id: "others", name: "Others" },
          { id: "absences", name: "Absences" },
        ],
      },
    })
    .select()
    .single();
  if (error) return { error: error.message };

  // Auto-add all org members to the new sprint
  const { data: orgUsers } = await supabase
    .from("profiles")
    .select("id")
    .eq("org_id", orgId);

  if (orgUsers && orgUsers.length > 0) {
    const participants = orgUsers.map((u) => ({
      sprint_id: data.id,
      user_id: u.id,
      base_points: payload.base_points,
      scores: {},
      project_allocations: {},
    }));
    await supabase.from("sprint_participants").insert(participants);
  }

  revalidatePath("/sprints");
  return { data };
}

export async function deleteSprint(id: string) {
  const { supabase } = await requireAdminClient();
  const { error } = await supabase.from("sprints").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/sprints");
  return {};
}

export async function getSprintById(id: string) {
  const { supabase } = await requireAdminClient();
  const { data } = await supabase
    .from("sprints")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function updateSprintColumns(id: string, columns: object) {
  const { supabase } = await requireAdminClient();
  const { error } = await supabase.from("sprints").update({ columns }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/sprints/${id}`);
  return {};
}

export async function updateSprintStatus(id: string, status: "active" | "completed") {
  const { supabase } = await requireAdminClient();
  const { error } = await supabase.from("sprints").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/sprints/${id}`);
  revalidatePath("/sprints");
  return {};
}

// ── SPRINT PARTICIPANTS ────────────────────────────────────────

export async function getSprintParticipants(sprintId: string) {
  const { supabase } = await requireAdminClient();
  const { data } = await supabase
    .from("sprint_participants")
    .select("*, profile:profiles(id, full_name, avatar_url, job_title)")
    .eq("sprint_id", sprintId);
    
  if (data) {
    // Sort by name ascending for the grid
    data.sort((a: any, b: any) => a.profile.full_name.localeCompare(b.profile.full_name));
  }
  return data ?? [];
}

export async function getOrgUsers() {
  const { supabase, orgId } = await requireAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, job_title")
    .eq("org_id", orgId)
    .order("full_name");
  return data ?? [];
}

export async function addParticipant(sprintId: string, userId: string, basePoints: number) {
  const { supabase } = await requireAdminClient();
  const { error } = await supabase.from("sprint_participants").upsert({
    sprint_id: sprintId,
    user_id: userId,
    base_points: basePoints,
    scores: {},
    project_allocations: {},
  });
  if (error) return { error: error.message };
  revalidatePath(`/sprints/${sprintId}`);
  return {};
}

export async function removeParticipant(sprintId: string, userId: string) {
  const { supabase } = await requireAdminClient();
  const { error } = await supabase
    .from("sprint_participants")
    .delete()
    .eq("sprint_id", sprintId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath(`/sprints/${sprintId}`);
  return {};
}

export async function updateParticipantScores(
  sprintId: string,
  userId: string,
  scores: Record<string, number>,
  basePoints: number,
  projectAllocations: Record<string, number>
) {
  const { supabase } = await requireAdminClient();
  const { error } = await supabase
    .from("sprint_participants")
    .update({ scores, base_points: basePoints, project_allocations: projectAllocations })
    .eq("sprint_id", sprintId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath(`/sprints/${sprintId}`);
  return {};
}

export async function updateAllParticipants(
  sprintId: string,
  payload: {
    user_id: string;
    scores: Record<string, number>;
    base_points: number;
    project_allocations: Record<string, number>;
  }[]
) {
  const { supabase } = await requireAdminClient();
  
  // Upsert all records (Supabase upsert works with bulk arrays)
  const { error } = await supabase
    .from("sprint_participants")
    .upsert(payload.map(p => ({
      sprint_id: sprintId,
      user_id: p.user_id,
      scores: p.scores,
      base_points: p.base_points,
      project_allocations: p.project_allocations
    })), { onConflict: "sprint_id,user_id" });

  if (error) return { error: error.message };
  revalidatePath(`/sprints/${sprintId}`);
  return {};
}

// ── ANALYTICS ──────────────────────────────────────────────────

export async function getAdminAnalytics() {
  const { supabase, orgId } = await requireAdminClient();

  // Fetch everything in parallel
  const [
    { data: sprints },
    { data: projects },
    { data: participants },
    { data: orgUsers }
  ] = await Promise.all([
    supabase.from("sprints").select("*").eq("org_id", orgId).order("start_date", { ascending: false }),
    supabase.from("projects").select("*").eq("org_id", orgId).order("name"),
    supabase.from("sprint_participants").select("*, profile:profiles(id, full_name, avatar_url, job_title)").order("created_at"),
    supabase.from("profiles").select("id, full_name, avatar_url, job_title").eq("org_id", orgId).order("full_name")
  ]);

  // Filter participants to only those belonging to sprints of this org
  // (In a scale-up scenario, this would be a join or internal RLS is enough)
  const sprintIds = new Set(sprints?.map(s => s.id) || []);
  const filteredParticipants = participants?.filter(p => sprintIds.has(p.sprint_id)) || [];

  return {
    sprints: sprints || [],
    projects: projects || [],
    participants: filteredParticipants,
    orgUsers: orgUsers || []
  };
}
