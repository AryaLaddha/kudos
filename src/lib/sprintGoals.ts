import type { GoalAssignment, GoalStatus, RoleRequirement, SprintGoal, SprintRef } from "@/types";

// ── Capacity roles ─────────────────────────────────────────────────────────────
// The fixed catalogue of capacity roles a goal can require and a member can fill.
export const ROLE_OPTIONS = ["Dev", "BA", "QA", "Designer", "PM"] as const;
export type CapacityRole = (typeof ROLE_OPTIONS)[number];

/** Normalize raw role-requirement input: valid role, integer 1–100%, deduped by role. */
export function sanitizeRoleRequirements(input: { role: string; pct: number | string }[]): RoleRequirement[] {
  const seen = new Set<string>();
  const out: RoleRequirement[] = [];
  for (const r of input) {
    const role = (r.role ?? "").trim();
    const pct = Math.round(Number(r.pct));
    if (!ROLE_OPTIONS.includes(role as CapacityRole)) continue;
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) continue;
    if (seen.has(role)) continue;
    seen.add(role);
    out.push({ role, pct });
  }
  return out;
}

// ── Role coverage / gap analysis ───────────────────────────────────────────────

export type RoleCoverage = {
  role: string;
  requiredPct: number;
  assignedPct: number;
  assignment: GoalAssignment | null;
  gap: number; // required - assigned (positive = under-staffed, negative = over)
};

/** Per-role coverage for a goal: pair each required role with its assignment. */
export function goalRoleCoverage(goal: SprintGoal, assignments: GoalAssignment[]): RoleCoverage[] {
  const byRole = new Map(assignments.filter((a) => a.goal_id === goal.id).map((a) => [a.role, a]));
  return (goal.role_requirements ?? []).map((req) => {
    const assignment = byRole.get(req.role) ?? null;
    const assignedPct = assignment?.allocation_pct ?? 0;
    return { role: req.role, requiredPct: req.pct, assignedPct, assignment, gap: req.pct - assignedPct };
  });
}

// ── Goal ↔ sprint relationship ────────────────────────────────────────────────
// A goal "appears in" a sprint when their date ranges overlap. Date keys
// (YYYY-MM-DD) compare correctly as plain strings.

export function overlapsSprint(
  goal: { start_date: string | null; end_date: string | null },
  sprint: { start_date: string; end_date: string },
): boolean {
  if (!goal.start_date || !goal.end_date) return false;
  return goal.start_date <= sprint.end_date && goal.end_date >= sprint.start_date;
}

// ── Status presentation ───────────────────────────────────────────────────────

export type StatusMeta = { label: string; pillBg: string; pillText: string; dotBg: string; dotText: string };

export const GOAL_STATUS_META: Record<GoalStatus, StatusMeta> = {
  on_track:     { label: "On Track",     pillBg: "#DCFCE7", pillText: "#166534", dotBg: "#DCFCE7", dotText: "#166534" },
  delayed:      { label: "Delayed",      pillBg: "#FEE2E2", pillText: "#991B1B", dotBg: "#FEE2E2", dotText: "#991B1B" },
  completed:    { label: "Completed",    pillBg: "#DBEAFE", pillText: "#1E40AF", dotBg: "#DBEAFE", dotText: "#1E40AF" },
  carried_over: { label: "Carried Over", pillBg: "#EDE9FE", pillText: "#5B21B6", dotBg: "#EDE9FE", dotText: "#5B21B6" },
};

export const GOAL_STATUSES: GoalStatus[] = ["on_track", "delayed", "completed", "carried_over"];

// ── Deterministic colours for goals & streams (no colour column needed) ──────
const PALETTE = [
  "#7C3AED", "#2563EB", "#D97706", "#DC2626", "#059669",
  "#0EA5E9", "#DB2777", "#65A30D", "#9333EA", "#0D9488",
];

export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// ── Capacity computation ──────────────────────────────────────────────────────

/** Sum of a participant's allocation percentages. */
export function totalAllocation(allocations: Record<string, number>): number {
  return Object.values(allocations).reduce((sum, v) => sum + (v || 0), 0);
}

/**
 * Auto-expected points = Σ over allocated goals (goal.points × allocation% / 100),
 * counting only goals that exist in the provided lookup (i.e. active in the sprint).
 */
export function autoExpectedPoints(
  allocations: Record<string, number>,
  goalsById: Map<string, SprintGoal>,
): number {
  let total = 0;
  for (const [goalId, pct] of Object.entries(allocations)) {
    const goal = goalsById.get(goalId);
    if (goal) total += ((goal.points ?? 0) * (pct || 0)) / 100;
  }
  return Math.round(total * 10) / 10;
}

/** Effective expected = manual override when set, otherwise the auto figure. */
export function effectiveExpected(
  override: number | null,
  allocations: Record<string, number>,
  goalsById: Map<string, SprintGoal>,
): number {
  if (override !== null && override !== undefined) return override;
  return autoExpectedPoints(allocations, goalsById);
}

// ── Per-user capacity from role assignments ─────────────────────────────────────

/** Auto expected points for a user = Σ (goal.points × allocation% / 100) over their assignments. */
export function assignmentExpectedPoints(
  userAssignments: GoalAssignment[],
  goalsById: Map<string, SprintGoal>,
): number {
  let total = 0;
  for (const a of userAssignments) {
    const goal = goalsById.get(a.goal_id);
    if (goal) total += ((goal.points ?? 0) * (a.allocation_pct || 0)) / 100;
  }
  return Math.round(total * 10) / 10;
}

/** Sum of a user's allocation percentages across all their assignments. */
export function assignmentAllocationTotal(userAssignments: GoalAssignment[]): number {
  return userAssignments.reduce((s, a) => s + (a.allocation_pct || 0), 0);
}

// ── Goal History journey ──────────────────────────────────────────────────────

export type JourneyDot = { sprint: SprintRef; status: "on_track" | "delayed" | "completed" | "carried" | "scheduled" };

/**
 * Build the per-sprint journey for a goal: one dot per sprint the goal overlaps,
 * in chronological order. A sprint is "delayed" if a delay was logged against it,
 * "completed" if the goal completed within/before it, "carried" if the goal's
 * window extends into a later sprint, else "on_track" (or "scheduled" if future).
 */
export function goalJourney(
  goal: SprintGoal,
  sprints: SprintRef[],
  todayKey: string,
): JourneyDot[] {
  const overlapping = sprints
    .filter((s) => overlapsSprint(goal, s))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const delayedSprintIds = new Set((goal.delays ?? []).map((d) => d.sprint_id).filter(Boolean) as string[]);
  const lastIdx = overlapping.length - 1;

  return overlapping.map((sprint, idx) => {
    let status: JourneyDot["status"];
    const completedHere =
      goal.status === "completed" && goal.completed_at && goal.completed_at.slice(0, 10) <= sprint.end_date;
    if (delayedSprintIds.has(sprint.id)) {
      status = "delayed";
    } else if (completedHere) {
      status = "completed";
    } else if (idx < lastIdx) {
      // The goal's window continues into a later sprint.
      status = "carried";
    } else if (sprint.start_date > todayKey) {
      status = "scheduled";
    } else {
      status = "on_track";
    }
    return { sprint, status };
  });
}
