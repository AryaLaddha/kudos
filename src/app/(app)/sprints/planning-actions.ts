"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { canManageSprints } from "@/lib/auth";
import { expectedPoints, holidayIndex, totalAvailability, workingDays } from "@/lib/sprintAvailability";
import type { AvailabilityMap, GoalNote, PublicHoliday } from "@/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE = 1000;
const MAX_HOLIDAY_NAME = 80;

// Same authorization pattern as ./goals-actions.ts: admins or sprint managers.
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

// ── Public holidays ───────────────────────────────────────────────────────────

// Returns [] when the table isn't there yet, so the sprint page still loads before the migration runs.
export async function getPublicHolidays(): Promise<PublicHoliday[]> {
  const { supabase, orgId } = await requireSprintClient();
  const { data, error } = await supabase
    .from("public_holidays")
    .select("*")
    .eq("org_id", orgId)
    .order("holiday_date");
  if (error) return [];
  return (data as PublicHoliday[]) ?? [];
}

export async function addPublicHoliday(payload: {
  location: string;
  holiday_date: string;
  name: string;
}): Promise<{ error?: string; holiday?: PublicHoliday }> {
  const { supabase, orgId } = await requireSprintClient();
  const name = payload.name.trim();
  if (!payload.location) return { error: "Pick a location." };
  if (!DATE_RE.test(payload.holiday_date)) return { error: "Choose a valid date." };
  if (!name) return { error: "Give the holiday a name." };
  if (name.length > MAX_HOLIDAY_NAME) return { error: `Name must be ${MAX_HOLIDAY_NAME} characters or fewer.` };
  const { data, error } = await supabase
    .from("public_holidays")
    .upsert(
      { org_id: orgId, location: payload.location, holiday_date: payload.holiday_date, name },
      { onConflict: "org_id,location,holiday_date" },
    )
    .select()
    .single();
  if (error) return { error: error.message };
  return { holiday: data as PublicHoliday };
}

export async function deletePublicHoliday(id: string): Promise<{ error?: string }> {
  const { supabase, orgId } = await requireSprintClient();
  const { error } = await supabase.from("public_holidays").delete().eq("id", id).eq("org_id", orgId);
  if (error) return { error: error.message };
  return {};
}

// ── Availability ──────────────────────────────────────────────────────────────

export type AvailabilityRow = {
  user_id: string;
  location: string | null;
  buddy_user_ids: string[];
  deducted_points: number;
  availability: AvailabilityMap;
  expected_override: number;
};

function validateAvailability(a: AvailabilityMap): string | null {
  for (const [date, v] of Object.entries(a)) {
    if (!DATE_RE.test(date)) return "Availability contains an invalid date.";
    if (v !== "AL" && (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1)) {
      return "Daily availability must be between 0 and 1, or AL for approved leave.";
    }
  }
  return null;
}

/** Save availability, location, buddies and deductions, plus the recalculated expected points. */
export async function saveAvailability(
  sprintId: string,
  rows: AvailabilityRow[],
): Promise<{ error?: string }> {
  const { supabase } = await requireSprintClient();
  for (const r of rows) {
    const problem = validateAvailability(r.availability);
    if (problem) return { error: problem };
    if (!Number.isFinite(r.deducted_points) || r.deducted_points < 0) return { error: "Deducted points can't be negative." };
    if (r.buddy_user_ids.includes(r.user_id)) return { error: "Someone can't be their own buddy." };
    const { error } = await supabase
      .from("sprint_participants")
      .update({
        location: r.location || null,
        buddy_user_ids: r.buddy_user_ids,
        deducted_points: Math.round(r.deducted_points * 10) / 10,
        availability: r.availability,
        expected_override: Math.max(0, Math.round(r.expected_override * 10) / 10),
      })
      .eq("sprint_id", sprintId)
      .eq("user_id", r.user_id);
    if (error) return { error: error.message };
  }
  revalidatePath(`/sprints/${sprintId}`);
  return {};
}

// ── Goal notes ────────────────────────────────────────────────────────────────

export async function getGoalNotes(goalIds: string[]): Promise<GoalNote[]> {
  if (goalIds.length === 0) return [];
  const { supabase, orgId } = await requireSprintClient();
  const { data, error } = await supabase
    .from("goal_notes")
    .select("*")
    .eq("org_id", orgId)
    .in("goal_id", goalIds)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as GoalNote[]) ?? [];
}

export async function addGoalNote(goalId: string, body: string): Promise<{ error?: string; note?: GoalNote }> {
  const { supabase, orgId, user } = await requireSprintClient();
  const text = body.trim();
  if (!text) return { error: "Write a note first." };
  if (text.length > MAX_NOTE) return { error: `Notes must be ${MAX_NOTE} characters or fewer.` };
  const { data: goal } = await supabase.from("sprint_goals").select("id").eq("id", goalId).eq("org_id", orgId).single();
  if (!goal) return { error: "Goal not found." };
  const { data, error } = await supabase
    .from("goal_notes")
    .insert({ org_id: orgId, goal_id: goalId, author_id: user.id, body: text })
    .select()
    .single();
  if (error) return { error: error.message };
  return { note: data as GoalNote };
}

// ── Clone sprint ──────────────────────────────────────────────────────────────

export type ClonePreview = {
  people: number;
  assignments: number;
  carriedGoals: { id: string; title: string }[];
  droppedGoals: { id: string; title: string }[];
};

type CloneOptions = { copyAssignments: boolean };

async function loadCloneInputs(
  supabase: Awaited<ReturnType<typeof requireSprintClient>>["supabase"],
  orgId: string,
  sourceSprintId: string,
  window: { start_date: string; end_date: string },
) {
  const [{ data: participants }, { data: assignments }, { data: openGoals }] = await Promise.all([
    supabase.from("sprint_participants").select("*").eq("sprint_id", sourceSprintId),
    supabase.from("goal_assignments").select("*").eq("org_id", orgId).eq("sprint_id", sourceSprintId),
    supabase.from("sprint_goals").select("id, title, start_date, end_date, status").eq("org_id", orgId).neq("status", "completed"),
  ]);
  const open = (openGoals ?? []) as { id: string; title: string; start_date: string | null; end_date: string | null }[];
  // A goal carries over when it is still open and its dates reach into the new sprint.
  const carried = open.filter((g) => g.start_date && g.end_date && g.start_date <= window.end_date && g.end_date >= window.start_date);
  const carriedIds = new Set(carried.map((g) => g.id));
  const sourceGoalIds = new Set((assignments ?? []).map((a: { goal_id: string }) => a.goal_id));
  // Open goals the source sprint staffed whose dates end before the new sprint starts.
  const dropped = open.filter((g) => sourceGoalIds.has(g.id) && !carriedIds.has(g.id));
  return { participants: participants ?? [], assignments: assignments ?? [], carried, dropped, carriedIds };
}

export async function previewClone(
  sourceSprintId: string,
  window: { start_date: string; end_date: string },
): Promise<{ error?: string; preview?: ClonePreview }> {
  const { supabase, orgId } = await requireSprintClient();
  if (!DATE_RE.test(window.start_date) || !DATE_RE.test(window.end_date)) return { error: "Choose valid dates." };
  const c = await loadCloneInputs(supabase, orgId, sourceSprintId, window);
  const kept = c.assignments.filter((a: { goal_id: string }) => c.carriedIds.has(a.goal_id));
  return {
    preview: {
      people: c.participants.length,
      assignments: kept.length,
      carriedGoals: c.carried.map((g) => ({ id: g.id, title: g.title })),
      droppedGoals: c.dropped.map((g) => ({ id: g.id, title: g.title })),
    },
  };
}

/**
 * Create the next sprint from an existing one: same people, roles, streams, buddies and default
 * deductions; expected points recalculated for the new dates and holidays; role assignments kept
 * for goals that are still open and reach into the new dates. Leave is date-specific, so it is not copied.
 */
export async function cloneSprint(
  sourceSprintId: string,
  payload: { name: string; start_date: string; end_date: string } & CloneOptions,
): Promise<{ error?: string; sprintId?: string }> {
  const { supabase, orgId } = await requireSprintClient();
  const name = payload.name.trim();
  if (!name) return { error: "Give the sprint a name." };
  if (!DATE_RE.test(payload.start_date) || !DATE_RE.test(payload.end_date)) return { error: "Choose valid dates." };
  if (payload.end_date < payload.start_date) return { error: "End date can't be before the start date." };

  const { data: source } = await supabase.from("sprints").select("columns").eq("id", sourceSprintId).eq("org_id", orgId).single();
  if (!source) return { error: "Source sprint not found." };

  const { data: created, error: createErr } = await supabase
    .from("sprints")
    .insert({
      name,
      start_date: payload.start_date,
      end_date: payload.end_date,
      org_id: orgId,
      status: "active",
      columns: source.columns,
    })
    .select("id")
    .single();
  if (createErr || !created) return { error: createErr?.message ?? "Couldn't create the sprint." };
  const newId = created.id as string;

  const fail = async (message: string) => {
    await supabase.from("sprints").delete().eq("id", newId);
    return { error: message };
  };

  const c = await loadCloneInputs(supabase, orgId, sourceSprintId, payload);
  const { data: holidayRows } = await supabase.from("public_holidays").select("*").eq("org_id", orgId);
  const holidays = holidayIndex((holidayRows as PublicHoliday[]) ?? []);
  const days = workingDays(payload.start_date, payload.end_date);

  if (c.participants.length > 0) {
    const rows = c.participants.map((p: Record<string, unknown>) => {
      const location = (p.location as string | null) ?? null;
      const deducted = Number(p.deducted_points ?? 0);
      const hasAvailability = location !== null || deducted > 0;
      // People who never had availability set keep their manual expected points.
      const expected = hasAvailability
        ? expectedPoints(totalAvailability(days, location, {}, holidays), deducted)
        : (p.expected_override as number | null);
      return {
        sprint_id: newId,
        user_id: p.user_id,
        base_points: p.base_points ?? 0,
        scores: {},
        role: p.role ?? null,
        stream_ids: p.stream_ids ?? [],
        location,
        buddy_user_ids: p.buddy_user_ids ?? [],
        deducted_points: deducted,
        availability: {},
        expected_override: expected,
      };
    });
    const { error } = await supabase.from("sprint_participants").insert(rows);
    if (error) return fail(error.message);
  }

  if (payload.copyAssignments) {
    const kept = c.assignments.filter((a: { goal_id: string }) => c.carriedIds.has(a.goal_id));
    if (kept.length > 0) {
      const rows = kept.map((a: Record<string, unknown>) => ({
        org_id: orgId,
        sprint_id: newId,
        goal_id: a.goal_id,
        role: a.role,
        role_requirement_id: a.role_requirement_id ?? null,
        user_id: a.user_id,
        allocation_pct: a.allocation_pct ?? 0,
        allocated_points: a.allocated_points ?? 0,
      }));
      const { error } = await supabase.from("goal_assignments").insert(rows);
      if (error) return fail(error.message);
    }
  }

  revalidatePath("/sprints");
  return { sprintId: newId };
}
