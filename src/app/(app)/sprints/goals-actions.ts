"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { canManageSprints } from "@/lib/auth";
import { sanitizeRoleRequirements } from "@/lib/sprintGoals";
import type { GoalAssignment, GoalDelay, GoalSubtask, RoleRequirement, SprintGoal, SprintRef, Stream } from "@/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TITLE = 120;
const MAX_TAG = 30;
const MAX_REASON = 280;

// Authorize as admin or sprint manager. Sprint managers (non-DB-admins) use the
// service-role client to bypass RLS — authorization is enforced here first.
// (Mirrors requireSprintClient in ./actions.ts.)
async function requireSprintClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("is_admin, org_id").eq("id", user.id).single();
  const allowed = profile?.is_admin || (await canManageSprints());
  if (!allowed) throw new Error("Forbidden");
  const client = profile?.is_admin ? supabase : createAdminClient();
  return { supabase: client, user, orgId: profile!.org_id! as string };
}

const GOAL_SELECT = "*, subtasks:goal_subtasks(*), delays:goal_delays(*)";

function sortGoalChildren(goal: SprintGoal) {
  goal.subtasks?.sort((a, b) => a.created_at.localeCompare(b.created_at));
  goal.delays?.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return goal;
}

// ── Streams ───────────────────────────────────────────────────────────────────

// Streams are read-only here (managed by admins in /admin/streams). The sprint
// pages need the catalogue to render and assign stream tags.
export async function getStreams(): Promise<Stream[]> {
  const { supabase, orgId } = await requireSprintClient();
  const { data } = await supabase
    .from("streams")
    .select("id, name, is_archived")
    .eq("org_id", orgId)
    .order("name");
  return (data as Stream[]) ?? [];
}

// ── Goals ──────────────────────────────────────────────────────────────────────

function validateGoalInput(p: { title: string; points: number; start_date: string; end_date: string }): string | null {
  if (!p.title.trim()) return "Title is required.";
  if (p.title.trim().length > MAX_TITLE) return `Title must be ${MAX_TITLE} characters or fewer.`;
  if (!Number.isFinite(p.points) || p.points <= 0) return "Points must be a positive number.";
  if (!DATE_RE.test(p.start_date) || !DATE_RE.test(p.end_date)) return "Please choose valid dates.";
  if (p.end_date < p.start_date) return "End date can't be before the start date.";
  return null;
}

/** Goals overlapping a given sprint's date window. */
export async function getSprintGoals(sprintId: string): Promise<SprintGoal[]> {
  const { supabase, orgId } = await requireSprintClient();
  const { data: sprint } = await supabase.from("sprints").select("start_date, end_date").eq("id", sprintId).single();
  if (!sprint) return [];
  const { data } = await supabase
    .from("sprint_goals")
    .select(GOAL_SELECT)
    .eq("org_id", orgId)
    .lte("start_date", sprint.end_date)
    .gte("end_date", sprint.start_date)
    .order("created_at", { ascending: false });
  return ((data as SprintGoal[]) ?? []).map(sortGoalChildren);
}

/** All org goals + the org's sprints, for the Goal History tab. */
export async function getGoalHistory(): Promise<{ goals: SprintGoal[]; sprints: SprintRef[] }> {
  const { supabase, orgId } = await requireSprintClient();
  const [{ data: goals }, { data: sprints }] = await Promise.all([
    supabase.from("sprint_goals").select(GOAL_SELECT).eq("org_id", orgId).order("start_date", { ascending: false }),
    supabase.from("sprints").select("id, name, start_date, end_date").eq("org_id", orgId).order("start_date"),
  ]);
  return {
    goals: ((goals as SprintGoal[]) ?? []).map(sortGoalChildren),
    sprints: (sprints as SprintRef[]) ?? [],
  };
}

export async function createGoal(payload: {
  title: string;
  points: number;
  start_date: string;
  end_date: string;
  stream_ids: string[];
  tags: string[];
  role_requirements?: RoleRequirement[];
}): Promise<{ error?: string; goal?: SprintGoal }> {
  const { supabase, orgId, user } = await requireSprintClient();
  const err = validateGoalInput(payload);
  if (err) return { error: err };
  const tags = payload.tags.map((t) => t.trim()).filter(Boolean).filter((t) => t.length <= MAX_TAG);
  const roleRequirements = sanitizeRoleRequirements(payload.role_requirements ?? []);
  const { data, error } = await supabase
    .from("sprint_goals")
    .insert({
      org_id: orgId,
      title: payload.title.trim(),
      points: Math.round(payload.points),
      start_date: payload.start_date,
      end_date: payload.end_date,
      original_end_date: payload.end_date,
      stream_ids: payload.stream_ids,
      tags,
      role_requirements: roleRequirements,
      created_by: user.id,
    })
    .select(GOAL_SELECT)
    .single();
  if (error) return { error: error.message };
  return { goal: sortGoalChildren(data as SprintGoal) };
}

export async function updateGoal(
  id: string,
  payload: { title: string; points: number; start_date: string; end_date: string; stream_ids: string[]; tags: string[]; role_requirements?: RoleRequirement[]; status?: SprintGoal["status"] },
): Promise<{ error?: string; goal?: SprintGoal }> {
  const { supabase } = await requireSprintClient();
  const err = validateGoalInput(payload);
  if (err) return { error: err };
  const tags = payload.tags.map((t) => t.trim()).filter(Boolean).filter((t) => t.length <= MAX_TAG);
  const patch: Record<string, unknown> = {
    title: payload.title.trim(),
    points: Math.round(payload.points),
    start_date: payload.start_date,
    end_date: payload.end_date,
    stream_ids: payload.stream_ids,
    tags,
    role_requirements: sanitizeRoleRequirements(payload.role_requirements ?? []),
  };
  if (payload.status) patch.status = payload.status;
  const { data, error } = await supabase.from("sprint_goals").update(patch).eq("id", id).select(GOAL_SELECT).single();
  if (error) return { error: error.message };
  return { goal: sortGoalChildren(data as SprintGoal) };
}

/** Update only a goal's role requirements (used from the Capacity tab). */
export async function setGoalRoleRequirements(
  id: string,
  roleRequirements: RoleRequirement[],
): Promise<{ error?: string; goal?: SprintGoal }> {
  const { supabase } = await requireSprintClient();
  const { data, error } = await supabase
    .from("sprint_goals")
    .update({ role_requirements: sanitizeRoleRequirements(roleRequirements) })
    .eq("id", id)
    .select(GOAL_SELECT)
    .single();
  if (error) return { error: error.message };
  return { goal: sortGoalChildren(data as SprintGoal) };
}

export async function completeGoal(id: string, done: boolean): Promise<{ error?: string; goal?: SprintGoal }> {
  const { supabase, user } = await requireSprintClient();
  const patch = done
    ? { status: "completed", completed_at: new Date().toISOString(), completed_by: user.id }
    : { status: "on_track", completed_at: null, completed_by: null };
  const { data, error } = await supabase.from("sprint_goals").update(patch).eq("id", id).select(GOAL_SELECT).single();
  if (error) return { error: error.message };
  return { goal: sortGoalChildren(data as SprintGoal) };
}

export async function deleteGoal(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireSprintClient();
  const { error } = await supabase.from("sprint_goals").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

// ── Subtasks ────────────────────────────────────────────────────────────────

export async function addSubtask(
  goalId: string,
  name: string,
  dueDate: string | null,
): Promise<{ error?: string; subtask?: GoalSubtask }> {
  const { supabase } = await requireSprintClient();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Subtask name is required." };
  if (dueDate && !DATE_RE.test(dueDate)) return { error: "Invalid due date." };
  const { data, error } = await supabase
    .from("goal_subtasks")
    .insert({ goal_id: goalId, name: trimmed, due_date: dueDate })
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { subtask: data as GoalSubtask };
}

export async function toggleSubtask(id: string, isDone: boolean): Promise<{ error?: string }> {
  const { supabase } = await requireSprintClient();
  const { error } = await supabase
    .from("goal_subtasks")
    .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function deleteSubtask(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireSprintClient();
  const { error } = await supabase.from("goal_subtasks").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

// ── Delays ──────────────────────────────────────────────────────────────────

export async function markGoalDelayed(
  goalId: string,
  payload: { sprintId: string | null; subtaskId: string | null; newDueDate: string | null; reason: string },
): Promise<{ error?: string; goal?: SprintGoal; delay?: GoalDelay }> {
  const { supabase, user } = await requireSprintClient();
  const reason = payload.reason.trim();
  if (!reason) return { error: "A reason is required." };
  if (reason.length > MAX_REASON) return { error: `Reason must be ${MAX_REASON} characters or fewer.` };
  if (payload.newDueDate && !DATE_RE.test(payload.newDueDate)) return { error: "Invalid new due date." };

  const { data: delay, error: delayErr } = await supabase
    .from("goal_delays")
    .insert({
      goal_id: goalId,
      sprint_id: payload.sprintId,
      subtask_id: payload.subtaskId,
      reason,
      new_due_date: payload.newDueDate,
      reported_by: user.id,
    })
    .select("*")
    .single();
  if (delayErr) return { error: delayErr.message };

  // Mark the goal delayed and, if the new due date extends it, push out end_date.
  const { data: goalRow } = await supabase.from("sprint_goals").select("end_date").eq("id", goalId).single();
  const patch: Record<string, unknown> = { status: "delayed" };
  if (payload.newDueDate && goalRow && payload.newDueDate > goalRow.end_date) {
    patch.end_date = payload.newDueDate;
  }
  const { data: goal, error: goalErr } = await supabase
    .from("sprint_goals")
    .update(patch)
    .eq("id", goalId)
    .select(GOAL_SELECT)
    .single();
  if (goalErr) return { error: goalErr.message };
  return { goal: sortGoalChildren(goal as SprintGoal), delay: delay as GoalDelay };
}

// ── Capacity ──────────────────────────────────────────────────────────────────

/** All role assignments for a sprint (goal × role × person). */
export async function getGoalAssignments(sprintId: string): Promise<GoalAssignment[]> {
  const { supabase, orgId } = await requireSprintClient();
  const { data } = await supabase
    .from("goal_assignments")
    .select("*")
    .eq("org_id", orgId)
    .eq("sprint_id", sprintId);
  return (data as GoalAssignment[]) ?? [];
}

/** Assign (or re-assign) a person + allocation to a role on a goal. */
export async function assignRole(payload: {
  sprintId: string;
  goalId: string;
  role: string;
  userId: string;
  allocationPct: number;
}): Promise<{ error?: string; assignment?: GoalAssignment }> {
  const { supabase, orgId } = await requireSprintClient();
  const pct = Math.round(Number(payload.allocationPct));
  if (!payload.userId) return { error: "Pick a person to assign." };
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return { error: "Allocation must be between 1 and 100%." };
  const { data, error } = await supabase
    .from("goal_assignments")
    .upsert(
      {
        org_id: orgId,
        sprint_id: payload.sprintId,
        goal_id: payload.goalId,
        role: payload.role,
        user_id: payload.userId,
        allocation_pct: pct,
      },
      { onConflict: "sprint_id,goal_id,role" },
    )
    .select("*")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/sprints/${payload.sprintId}`);
  return { assignment: data as GoalAssignment };
}

/** Clear the assignment for a role on a goal. */
export async function unassignRole(payload: {
  sprintId: string;
  goalId: string;
  role: string;
}): Promise<{ error?: string }> {
  const { supabase, orgId } = await requireSprintClient();
  const { error } = await supabase
    .from("goal_assignments")
    .delete()
    .eq("org_id", orgId)
    .eq("sprint_id", payload.sprintId)
    .eq("goal_id", payload.goalId)
    .eq("role", payload.role);
  if (error) return { error: error.message };
  revalidatePath(`/sprints/${payload.sprintId}`);
  return {};
}

/** Add (or update) a sprint capacity member: role + expected points. */
export async function addSprintMember(payload: {
  sprintId: string;
  userId: string;
  role: string;
  expectedPoints: number | null;
}): Promise<{ error?: string }> {
  const { supabase } = await requireSprintClient();
  if (!payload.userId) return { error: "Pick a person to add." };
  const expected =
    payload.expectedPoints === null || payload.expectedPoints === undefined
      ? null
      : Math.max(0, Math.round(Number(payload.expectedPoints)));
  const { error } = await supabase.from("sprint_participants").upsert(
    {
      sprint_id: payload.sprintId,
      user_id: payload.userId,
      role: payload.role || null,
      expected_override: expected,
      base_points: 0,
      scores: {},
    },
    { onConflict: "sprint_id,user_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/sprints/${payload.sprintId}`);
  return {};
}

export async function updateParticipantCapacity(
  sprintId: string,
  userId: string,
  payload: {
    role: string | null;
    expected_override: number | null;
    manual_deducted_points: number;
    stream_ids: string[];
  },
): Promise<{ error?: string }> {
  const { supabase } = await requireSprintClient();
  const { error } = await supabase
    .from("sprint_participants")
    .update({
      role: payload.role || null,
      expected_override: payload.expected_override,
      manual_deducted_points: Math.max(0, Math.round(payload.manual_deducted_points || 0)),
      stream_ids: payload.stream_ids,
    })
    .eq("sprint_id", sprintId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath(`/sprints/${sprintId}`);
  return {};
}
