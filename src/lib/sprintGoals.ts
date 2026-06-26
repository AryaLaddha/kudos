import type { GoalAssignment, GoalStatus, RoleRequirement, SprintGoal, SprintRef } from "@/types";

export const DEFAULT_ROLE_NAMES = ["Dev", "BA", "QA", "Designer", "PM"];

function makeRequirementId() {
  return globalThis.crypto?.randomUUID?.() ?? `role_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function roundPointValue(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatRolePoints(points: number | null | undefined) {
  if (points === null || points === undefined) return "No pts";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(points)} pts`;
}

export function distributeRolePoints<T extends { points: number | string | null | undefined }>(
  rows: T[],
  goalPoints: number | null | undefined,
): (number | null)[] {
  if (!goalPoints || !Number.isFinite(goalPoints) || goalPoints <= 0 || rows.length === 0) {
    return rows.map((row) => {
      const n = Number(row.points);
      return Number.isFinite(n) && n > 0 ? roundPointValue(n) : null;
    });
  }

  const current = rows.map((row) => {
    if (row.points === null || row.points === undefined || row.points === "") return null;
    const n = Number(row.points);
    return Number.isFinite(n) && n > 0 ? roundPointValue(n) : null;
  });
  const blankIndexes = current.flatMap((value, index) => (value === null ? [index] : []));
  if (blankIndexes.length === 0) return current;

  const used = current.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const remaining = Math.max(0, goalPoints - used);
  const share = roundPointValue(remaining / blankIndexes.length);
  const next = [...current];
  blankIndexes.forEach((index, i) => {
    const isLast = i === blankIndexes.length - 1;
    const value = isLast ? roundPointValue(remaining - share * (blankIndexes.length - 1)) : share;
    next[index] = value > 0 ? value : null;
  });
  return next;
}

export function sanitizeRoleRequirements(
  input: ({ id?: string; role: string; points?: number | string | null; pct?: number | string | null })[],
  validRoles: string[] = DEFAULT_ROLE_NAMES,
  goalPoints?: number | null,
): RoleRequirement[] {
  const valid = new Set(validRoles.map((r) => r.trim()).filter(Boolean));
  const candidates = input
    .map((r) => ({
      id: (r.id ?? "").trim() || makeRequirementId(),
      role: (r.role ?? "").trim(),
      points: r.points ?? (r.pct !== undefined && goalPoints ? (Number(goalPoints) * Number(r.pct)) / 100 : null),
    }))
    .filter((r) => r.role && valid.has(r.role));
  const distributed = distributeRolePoints(candidates, goalPoints);
  return candidates.map((r, index) => ({ id: r.id, role: r.role, points: distributed[index] }));
}

export type RoleCoverage = {
  id: string;
  role: string;
  requiredPoints: number | null;
  assignedPoints: number;
  assignment: GoalAssignment | null;
  gap: number | null;
};

export function goalRoleCoverage(goal: SprintGoal, assignments: GoalAssignment[]): RoleCoverage[] {
  const byReqId = new Map(
    assignments.filter((a) => a.goal_id === goal.id && a.role_requirement_id).map((a) => [a.role_requirement_id!, a]),
  );
  const fallbackUsed = new Set<string>();
  return (goal.role_requirements ?? []).map((req) => {
    let assignment = byReqId.get(req.id) ?? null;
    if (!assignment) {
      assignment = assignments.find((a) => a.goal_id === goal.id && a.role === req.role && !fallbackUsed.has(a.id)) ?? null;
      if (assignment) fallbackUsed.add(assignment.id);
    }
    const assignedPoints = assignment?.allocated_points ?? req.points ?? 0;
    const gap = req.points === null || req.points === undefined ? null : roundPointValue(req.points - assignedPoints);
    return { id: req.id, role: req.role, requiredPoints: req.points, assignedPoints, assignment, gap };
  });
}

export function overlapsSprint(
  goal: { start_date: string | null; end_date: string | null },
  sprint: { start_date: string; end_date: string },
): boolean {
  if (!goal.start_date || !goal.end_date) return false;
  return goal.start_date <= sprint.end_date && goal.end_date >= sprint.start_date;
}

export type StatusMeta = { label: string; pillBg: string; pillText: string; dotBg: string; dotText: string };

export const GOAL_STATUS_META: Record<GoalStatus, StatusMeta> = {
  on_track: { label: "On Track", pillBg: "#DCFCE7", pillText: "#166534", dotBg: "#DCFCE7", dotText: "#166534" },
  delayed: { label: "Delayed", pillBg: "#FEE2E2", pillText: "#991B1B", dotBg: "#FEE2E2", dotText: "#991B1B" },
  completed: { label: "Completed", pillBg: "#DBEAFE", pillText: "#1E40AF", dotBg: "#DBEAFE", dotText: "#1E40AF" },
  carried_over: { label: "Carried Over", pillBg: "#EDE9FE", pillText: "#5B21B6", dotBg: "#EDE9FE", dotText: "#5B21B6" },
};

export const GOAL_STATUSES: GoalStatus[] = ["on_track", "delayed", "completed", "carried_over"];

const PALETTE = [
  "#7C3AED", "#2563EB", "#D97706", "#DC2626", "#059669",
  "#0EA5E9", "#DB2777", "#65A30D", "#9333EA", "#0D9488",
];

export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function totalAllocation(allocations: Record<string, number>): number {
  return Object.values(allocations).reduce((sum, v) => sum + (v || 0), 0);
}

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

export function effectiveExpected(
  override: number | null,
  allocations: Record<string, number>,
  goalsById: Map<string, SprintGoal>,
): number {
  if (override !== null && override !== undefined) return override;
  return autoExpectedPoints(allocations, goalsById);
}

export function assignmentExpectedPoints(
  userAssignments: GoalAssignment[],
  goalsById: Map<string, SprintGoal>,
): number {
  void goalsById;
  return Math.round(userAssignments.reduce((total, a) => total + (a.allocated_points || 0), 0) * 10) / 10;
}

export function assignmentAllocationTotal(userAssignments: GoalAssignment[]): number {
  return userAssignments.reduce((s, a) => s + (a.allocated_points || 0), 0);
}

export type JourneyDot = { sprint: SprintRef; status: "on_track" | "delayed" | "completed" | "carried" | "scheduled" };

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
      status = "carried";
    } else if (sprint.start_date > todayKey) {
      status = "scheduled";
    } else {
      status = "on_track";
    }
    return { sprint, status };
  });
}
