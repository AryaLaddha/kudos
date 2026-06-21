"use client";

import { useMemo, useState, useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import CapacityEditDialog, { type CapacityPatch } from "@/components/app/CapacityEditDialog";
import {
  assignmentExpectedPoints,
  colorForId,
  goalRoleCoverage,
  GOAL_STATUS_META,
  GOAL_STATUSES,
  ROLE_OPTIONS,
  type RoleCoverage,
} from "@/lib/sprintGoals";
import { assignRole, unassignRole, addSprintMember, setGoalRoleRequirements, updateCapacityPlanBulk } from "@/app/(app)/sprints/goals-actions";
import { formatDateRange } from "@/lib/leave";
import type { GoalAssignment, RoleRequirement, SprintGoal, Stream } from "@/types";
import { Pencil, Users, Plus, X, Check, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

interface CapacityMember {
  user_id: string;
  role: string | null;
  expected_override: number | null;
  stream_ids: string[];
  profile: { id: string; full_name: string; avatar_url: string | null; job_title?: string | null };
}

interface OrgUser { id: string; full_name: string; avatar_url?: string | null; job_title?: string | null; }

interface Props {
  sprint: { id: string };
  participants: CapacityMember[];
  goals: SprintGoal[];
  streams: Stream[];
  assignments: GoalAssignment[];
  setAssignments: React.Dispatch<React.SetStateAction<GoalAssignment[]>>;
  orgUsers: OrgUser[];
  onPatchParticipant: (userId: string, patch: Partial<CapacityMember>) => void;
  onMemberUpserted: (userId: string, role: string | null, expected: number | null) => void;
  onRemoveMember: (userId: string) => void;
  onGoalChange: (goal: SprintGoal) => void;
  readOnly?: boolean;
}

function initials(n: string) {
  return n.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

const NO_STREAM = "__none__";

type MemberDraft = {
  role: string;
  expected_override: string;
  stream_ids: string[];
};

type RoleDraft = {
  user_id: string;
  allocation_pct: string;
  required_pct: string;
};

export default function CapacityPlanningClient({
  sprint, participants, goals, streams, assignments, setAssignments, orgUsers,
  onPatchParticipant, onMemberUpserted, onRemoveMember, onGoalChange, readOnly = false,
}: Props) {
  const [editing, setEditing] = useState<CapacityMember | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkSaving, startBulkSave] = useTransition();
  const [memberDrafts, setMemberDrafts] = useState<Record<string, MemberDraft>>({});
  const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});

  // Filters
  const [streamFilter, setStreamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  // Inline role-assignment editor state. editKey = `${goalId}::${role}`.
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editUser, setEditUser] = useState("");
  const [editPct, setEditPct] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const goalsById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const memberName = useMemo(() => {
    const m = new Map<string, string>();
    participants.forEach((p) => m.set(p.user_id, p.profile.full_name));
    orgUsers.forEach((u) => { if (!m.has(u.id)) m.set(u.id, u.full_name); });
    return (id: string) => m.get(id) ?? "Unknown";
  }, [participants, orgUsers]);

  const assignmentsByUser = useMemo(() => {
    const m = new Map<string, GoalAssignment[]>();
    for (const a of assignments) {
      if (!m.has(a.user_id)) m.set(a.user_id, []);
      m.get(a.user_id)!.push(a);
    }
    return m;
  }, [assignments]);

  // Per-member derived capacity figures. Over/under is decided by POINTS:
  // allocated points (from role assignments) vs the member's manual expected points.
  const rows = useMemo(() => {
    return participants.map((p) => {
      const userAssignments = assignmentsByUser.get(p.user_id) ?? [];
      const allocated = assignmentExpectedPoints(userAssignments, goalsById);
      const expected = p.expected_override; // manual; null = not set
      const hasExpected = expected !== null && expected !== undefined;
      const utilization = hasExpected && expected > 0 ? Math.round((allocated / expected) * 100) : null;
      const over = hasExpected && allocated > expected;
      const under = hasExpected && allocated < expected;
      return { member: p, userAssignments, allocated, expected, hasExpected, utilization, over, under };
    });
  }, [participants, assignmentsByUser, goalsById]);

  const rowByUser = useMemo(() => new Map(rows.map((r) => [r.member.user_id, r])), [rows]);

  const stats = useMemo(() => {
    const members = rows.length;
    const totalExpected = rows.reduce((s, r) => s + (r.expected ?? 0), 0);
    const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
    const overCount = rows.filter((r) => r.over).length;
    const underCount = rows.filter((r) => r.under).length;
    return {
      members,
      totalExpected: Math.round(totalExpected * 10) / 10,
      totalAllocated: Math.round(totalAllocated * 10) / 10,
      overCount,
      underCount,
    };
  }, [rows]);

  // Goal IDs the filtered member is assigned to (null = no member filter).
  const goalIdsForUser = useMemo(() => {
    if (userFilter === "all") return null;
    return new Set(assignments.filter((a) => a.user_id === userFilter).map((a) => a.goal_id));
  }, [assignments, userFilter]);

  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      if (streamFilter !== "all" && !g.stream_ids.includes(streamFilter)) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (goalIdsForUser && !goalIdsForUser.has(g.id)) return false;
      return true;
    });
  }, [goals, streamFilter, statusFilter, goalIdsForUser]);

  const filtersActive = streamFilter !== "all" || statusFilter !== "all" || userFilter !== "all";
  const goalScopeActive = streamFilter !== "all" || statusFilter !== "all";

  // People summary follows the same top filters as the goal/role table.
  const visibleRows = useMemo(() => {
    const visibleGoalIds = new Set(filteredGoals.map((g) => g.id));
    return rows
      .filter((r) => userFilter === "all" || r.member.user_id === userFilter)
      .map((r) => {
        const userAssignments = r.userAssignments.filter((a) => visibleGoalIds.has(a.goal_id));
        const allocated = assignmentExpectedPoints(userAssignments, goalsById);
        const utilization = r.hasExpected && r.expected && r.expected > 0 ? Math.round((allocated / r.expected) * 100) : null;
        const over = r.hasExpected && allocated > (r.expected ?? 0);
        const under = r.hasExpected && allocated < (r.expected ?? 0);
        return { ...r, userAssignments, allocated, utilization, over, under };
      })
      .filter((r) => !goalScopeActive || r.userAssignments.length > 0);
  }, [filteredGoals, goalScopeActive, goalsById, rows, userFilter]);

  // Goals grouped by their first stream (unstreamed goals fall under "Other").
  const streamGroups = useMemo(() => {
    const byStream = new Map<string, SprintGoal[]>();
    for (const g of filteredGoals) {
      const key = g.stream_ids[0] ?? NO_STREAM;
      if (!byStream.has(key)) byStream.set(key, []);
      byStream.get(key)!.push(g);
    }
    // Order: catalogue stream order first, then "Other".
    const ordered: { key: string; label: string; goals: SprintGoal[] }[] = [];
    for (const s of streams) {
      if (byStream.has(s.id)) ordered.push({ key: s.id, label: s.name, goals: byStream.get(s.id)! });
    }
    if (byStream.has(NO_STREAM)) ordered.push({ key: NO_STREAM, label: "Other", goals: byStream.get(NO_STREAM)! });
    return ordered;
  }, [filteredGoals, streams]);

  // ── Assignment mutations ──────────────────────────────────────
  function applyAssignment(a: GoalAssignment) {
    setAssignments((prev) => [...prev.filter((x) => !(x.goal_id === a.goal_id && x.role === a.role)), a]);
  }
  function dropAssignment(goalId: string, role: string) {
    setAssignments((prev) => prev.filter((x) => !(x.goal_id === goalId && x.role === role)));
  }

  function startEdit(goalId: string, role: string, current: GoalAssignment | null, requiredPct: number) {
    setEditKey(`${goalId}::${role}`);
    setEditUser(current?.user_id ?? "");
    setEditPct(String(current?.allocation_pct ?? requiredPct));
  }
  function cancelEdit() {
    setEditKey(null);
    setEditUser("");
    setEditPct("");
  }
  async function saveEdit(goalId: string, role: string) {
    const key = `${goalId}::${role}`;
    setSavingKey(key);
    const res = await assignRole({ sprintId: sprint.id, goalId, role, userId: editUser, allocationPct: Number(editPct) });
    setSavingKey(null);
    if (res.error || !res.assignment) { toast.error(res.error ?? "Couldn't assign."); return; }
    applyAssignment(res.assignment);
    cancelEdit();
    toast.success("Role assigned.");
  }
  async function clearAssign(goalId: string, role: string) {
    const res = await unassignRole({ sprintId: sprint.id, goalId, role });
    if (res.error) { toast.error(res.error); return; }
    dropAssignment(goalId, role);
    cancelEdit();
  }

  // Add a required role to a goal — persists on the goal so the Sprint Goals tab updates too.
  async function addRoleToGoal(goal: SprintGoal, role: string, pct: number) {
    const next = [...(goal.role_requirements ?? []), { role, pct }];
    const res = await setGoalRoleRequirements(goal.id, next);
    if (res.error || !res.goal) { toast.error(res.error ?? "Couldn't add role."); return; }
    onGoalChange(res.goal);
    toast.success("Role added to goal.");
  }

  function roleKey(goalId: string, role: string) {
    return `${goalId}::${role}`;
  }

  function startEditAll() {
    setMemberDrafts(Object.fromEntries(participants.map((p) => [p.user_id, {
      role: p.role ?? "",
      expected_override: p.expected_override !== null && p.expected_override !== undefined ? String(p.expected_override) : "",
      stream_ids: p.stream_ids ?? [],
    } satisfies MemberDraft])));

    const assignmentByGoalRole = new Map(assignments.map((a) => [roleKey(a.goal_id, a.role), a]));
    setRoleDrafts(Object.fromEntries(goals.flatMap((goal) => (goal.role_requirements ?? []).map((req) => {
      const current = assignmentByGoalRole.get(roleKey(goal.id, req.role));
      return [roleKey(goal.id, req.role), {
        user_id: current?.user_id ?? "",
        allocation_pct: current ? String(current.allocation_pct) : String(req.pct),
        required_pct: String(req.pct),
      } satisfies RoleDraft];
    }))));
    setBulkEditing(true);
  }

  function cancelEditAll() {
    setBulkEditing(false);
    setMemberDrafts({});
    setRoleDrafts({});
  }

  function patchMemberDraft(userId: string, patch: Partial<MemberDraft>) {
    setMemberDrafts((prev) => ({ ...prev, [userId]: { ...prev[userId], ...patch } }));
  }

  function toggleMemberStream(userId: string, streamId: string) {
    setMemberDrafts((prev) => {
      const current = prev[userId]?.stream_ids ?? [];
      const next = current.includes(streamId) ? current.filter((id) => id !== streamId) : [...current, streamId];
      return { ...prev, [userId]: { ...prev[userId], stream_ids: next } };
    });
  }

  function patchRoleDraft(key: string, patch: Partial<RoleDraft>) {
    setRoleDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function saveEditAll() {
    const participantPayload = participants.map((p) => {
      const draft = memberDrafts[p.user_id];
      const expected = draft.expected_override.trim() === "" ? null : Number(draft.expected_override);
      if (expected !== null && !Number.isFinite(expected)) {
        toast.error(`${p.profile.full_name}: expected points must be a number.`);
        return "invalid" as const;
      }
      return {
        user_id: p.user_id,
        role: draft.role || null,
        expected_override: expected,
        stream_ids: draft.stream_ids,
      };
    });
    if (participantPayload.includes("invalid")) return;

    const roleRequirements = goals.map((goal) => {
      const reqs: RoleRequirement[] = [];
      for (const req of goal.role_requirements ?? []) {
        const draft = roleDrafts[roleKey(goal.id, req.role)];
        const pct = Math.round(Number(draft?.required_pct ?? req.pct));
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
          toast.error(`${goal.title}: required ${req.role} must be between 1 and 100%.`);
          return "invalid" as const;
        }
        reqs.push({ role: req.role, pct });
      }
      return { goal_id: goal.id, role_requirements: reqs };
    });
    if (roleRequirements.includes("invalid")) return;

    const assignmentPayload = goals.flatMap((goal) => (goal.role_requirements ?? []).map((req) => {
      const draft = roleDrafts[roleKey(goal.id, req.role)];
      const allocation = draft?.allocation_pct.trim() === "" ? null : Number(draft?.allocation_pct ?? req.pct);
      if (draft?.user_id && (allocation === null || !Number.isFinite(allocation) || allocation <= 0 || allocation > 100)) {
        toast.error(`${goal.title}: ${req.role} allocation must be between 1 and 100%.`);
        return "invalid" as const;
      }
      return {
        goal_id: goal.id,
        role: req.role,
        user_id: draft?.user_id || null,
        allocation_pct: allocation,
      };
    }));
    if (assignmentPayload.includes("invalid")) return;

    startBulkSave(async () => {
      const res = await updateCapacityPlanBulk(sprint.id, {
        participants: participantPayload as Exclude<(typeof participantPayload)[number], "invalid">[],
        roleRequirements: roleRequirements as Exclude<(typeof roleRequirements)[number], "invalid">[],
        assignments: assignmentPayload as Exclude<(typeof assignmentPayload)[number], "invalid">[],
      });
      if (res.error) { toast.error(res.error); return; }

      for (const p of participantPayload as Exclude<(typeof participantPayload)[number], "invalid">[]) {
        onPatchParticipant(p.user_id, {
          role: p.role,
          expected_override: p.expected_override,
          stream_ids: p.stream_ids,
        });
      }
      if (res.goals) res.goals.forEach(onGoalChange);
      if (res.assignments) setAssignments(res.assignments);
      setBulkEditing(false);
      setMemberDrafts({});
      setRoleDrafts({});
      toast.success("Capacity plan saved.");
    });
  }

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Stat label="Team Members" value={stats.members} color="text-indigo-600" />
        <Stat label="Total Expected Pts" value={stats.totalExpected} color="text-emerald-600" />
        <Stat label="Total Allocated Pts" value={stats.totalAllocated} color="text-sky-600" />
        <Stat label="Over-allocated" value={stats.overCount} color="text-red-600" />
        <Stat label="Under-utilized" value={stats.underCount} color="text-amber-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={streamFilter} onChange={(e) => setStreamFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 outline-none">
          <option value="all">All Streams</option>
          {streams.filter((s) => !s.is_archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 outline-none">
          <option value="all">All Statuses</option>
          {GOAL_STATUSES.map((s) => <option key={s} value={s}>{GOAL_STATUS_META[s].label}</option>)}
        </select>
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 outline-none">
          <option value="all">All Members</option>
          {participants.map((p) => <option key={p.user_id} value={p.user_id}>{p.profile.full_name}</option>)}
        </select>
        {filtersActive && (
          <button onClick={() => { setStreamFilter("all"); setStatusFilter("all"); setUserFilter("all"); }} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        <div className="flex-1" />
        {readOnly ? null : bulkEditing ? (
          <>
            <Button size="sm" variant="outline" onClick={cancelEditAll} disabled={bulkSaving} className="h-8 gap-1.5 text-xs px-3">
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={saveEditAll} disabled={bulkSaving} className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3">
              <Save className="h-3.5 w-3.5" /> {bulkSaving ? "Saving..." : "Save all"}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={startEditAll} disabled={participants.length === 0 && goals.length === 0} className="h-8 gap-1.5 text-xs px-3">
            <Pencil className="h-3.5 w-3.5" /> Edit all
          </Button>
        )}
      </div>

      {/* ── Per-stream goal / role tables ── */}
      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-400">No goals in this sprint window to staff.</p>
        </div>
      ) : streamGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-400">No goals match your filters.</p>
        </div>
      ) : (
        streamGroups.map((group) => (
          <div key={group.key} className="mb-6">
            <div className="flex items-center gap-2 mb-2.5">
              {group.key !== NO_STREAM && (
                <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: colorForId(group.key) }}>
                  {group.label}
                </span>
              )}
              <h3 className="text-sm font-bold text-slate-800">{group.label} Goals</h3>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 w-[240px]">Goal</th>
                    <th className="px-4 py-2.5">Role Assignments</th>
                    <th className="px-4 py-2.5 w-[150px]">Gap Status</th>
                  </tr>
                </thead>
                <tbody>
                  {group.goals.map((goal) => {
                    const coverage = goalRoleCoverage(goal, assignments);
                    const status = GOAL_STATUS_META[goal.status];
                    const gap = gapBadge(coverage);
                    return (
                      <tr key={goal.id} className="border-b border-slate-100 last:border-b-0 align-top">
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold text-slate-900">{goal.title}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                            {formatDateRange(goal.start_date, goal.end_date)}
                            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: status.pillBg, color: status.pillText }}>{status.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            {coverage.length === 0 && (
                              <p className="text-[11px] text-slate-400 italic">{readOnly ? "No required roles yet." : "No required roles yet — add one below."}</p>
                            )}
                            {coverage.map((c) => (
                              bulkEditing ? (
                                <BulkRoleAssignRow
                                  key={c.role}
                                  coverage={c}
                                  members={participants}
                                  draft={roleDrafts[roleKey(goal.id, c.role)]}
                                  onPatch={(patch) => patchRoleDraft(roleKey(goal.id, c.role), patch)}
                                />
                              ) : (
                                <RoleAssignRow
                                  key={c.role}
                                  goalId={goal.id}
                                  coverage={c}
                                  editing={editKey === `${goal.id}::${c.role}`}
                                  saving={savingKey === `${goal.id}::${c.role}`}
                                  members={participants}
                                  memberName={memberName}
                                  editUser={editUser}
                                  editPct={editPct}
                                  setEditUser={setEditUser}
                                  setEditPct={setEditPct}
                                  onStart={() => startEdit(goal.id, c.role, c.assignment, c.requiredPct)}
                                  onSave={() => saveEdit(goal.id, c.role)}
                                  onCancel={cancelEdit}
                                  onClear={() => clearAssign(goal.id, c.role)}
                                  readOnly={readOnly}
                                />
                              )
                            ))}
                            {!readOnly && !bulkEditing && (
                              <AddRoleInline
                                availableRoles={ROLE_OPTIONS.filter((r) => !(goal.role_requirements ?? []).some((rr) => rr.role === r))}
                                onAdd={(role, pct) => addRoleToGoal(goal, role, pct)}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${gap.cls}`}>{gap.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* ── People allocation summary ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white mt-2">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">People Allocation Summary</span>
          {!readOnly && !bulkEditing && (
            <Button size="sm" onClick={() => setAddOpen(true)} className="h-7 gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] px-2.5">
              <Plus className="h-3.5 w-3.5" /> Add Member
            </Button>
          )}
        </div>

        {visibleRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">{rows.length === 0 ? "No members yet — add people to the capacity plan." : "No members match your filters."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Member</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5 text-center">Expected Pts</th>
                  <th className="px-4 py-2.5">Points by Goal</th>
                  <th className="px-4 py-2.5 text-center w-[150px]">Allocation</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 w-[70px]"></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => {
                  const st = memberStatus(r.over, r.under, r.hasExpected);
                  return (
                    <tr key={r.member.user_id} className="border-b border-slate-100 last:border-b-0 align-top hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={r.member.profile.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[10px] font-bold">{initials(r.member.profile.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">{r.member.profile.full_name}</div>
                            {r.member.profile.job_title && <div className="text-[10px] text-slate-400 truncate">{r.member.profile.job_title}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {bulkEditing ? (
                          <div className="space-y-2">
                            <select
                              value={memberDrafts[r.member.user_id]?.role ?? ""}
                              onChange={(e) => patchMemberDraft(r.member.user_id, { role: e.target.value })}
                              className="h-8 w-full min-w-[120px] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
                            >
                              <option value="">No role</option>
                              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                            </select>
                            <div className="flex flex-wrap gap-1">
                              {streams.filter((s) => !s.is_archived || memberDrafts[r.member.user_id]?.stream_ids.includes(s.id)).map((s) => {
                                const on = memberDrafts[r.member.user_id]?.stream_ids.includes(s.id);
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => toggleMemberStream(r.member.user_id, s.id)}
                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300"}`}
                                  >
                                    {s.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : r.member.role
                          ? <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{r.member.role}</span>
                          : <span className="text-[11px] text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {bulkEditing ? (
                          <Input
                            type="number"
                            min={0}
                            value={memberDrafts[r.member.user_id]?.expected_override ?? ""}
                            onChange={(e) => patchMemberDraft(r.member.user_id, { expected_override: e.target.value })}
                            placeholder="pts"
                            className="h-8 w-20 text-center text-xs mx-auto"
                          />
                        ) : r.hasExpected ? (
                          <>
                            <div className="text-base font-extrabold text-indigo-600 leading-none">{r.expected}</div>
                            <div className="text-[10px] text-slate-400">exp pts</div>
                          </>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-medium">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.userAssignments.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic">No assignments</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {r.userAssignments.map((a) => {
                              const g = goalsById.get(a.goal_id);
                              const pts = g ? Math.round((g.points * a.allocation_pct) / 100 * 10) / 10 : 0;
                              return (
                                <div key={a.id} className="flex items-center justify-between gap-3 text-[11px]">
                                  <span className="truncate text-slate-600">{g?.title ?? "Goal"} <span className="text-slate-300">· {a.role}</span></span>
                                  <span className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-[10px] text-slate-400">{a.allocation_pct}%</span>
                                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-bold text-indigo-600">{pts} pts</span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`text-xs font-bold ${r.over ? "text-red-600" : r.under ? "text-amber-600" : "text-slate-700"}`}>
                            {r.allocated} <span className="text-slate-300 font-normal">/ {r.hasExpected ? r.expected : "—"}</span> pts
                          </div>
                          {r.hasExpected && (
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${r.over ? "bg-gradient-to-r from-red-500 to-red-400" : r.under ? "bg-gradient-to-r from-amber-500 to-amber-400" : "bg-gradient-to-r from-emerald-500 to-emerald-400"}`} style={{ width: `${Math.min(r.utilization ?? 0, 100)}%` }} />
                            </div>
                          )}
                          {r.utilization !== null && <span className="text-[10px] text-slate-400">{r.utilization}%</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {!readOnly && !bulkEditing && (
                            <>
                              <button onClick={() => setEditing(r.member)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Edit member"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => onRemoveMember(r.member.user_id)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50" title="Remove from sprint"><Trash2 className="h-3.5 w-3.5" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Member settings dialog */}
      {editing && (
        <CapacityEditDialog
          key={editing.user_id}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          sprint={sprint}
          participant={editing}
          streams={streams}
          allocatedPoints={rowByUser.get(editing.user_id)?.allocated ?? 0}
          onSaved={(patch: CapacityPatch) => { onPatchParticipant(editing.user_id, patch); setEditing(null); }}
        />
      )}

      {/* Add member dialog */}
      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        sprint={sprint}
        orgUsers={orgUsers}
        existingIds={new Set(participants.map((p) => p.user_id))}
        onAdded={(userId, role, expected) => { onMemberUpserted(userId, role, expected); setAddOpen(false); }}
      />
    </div>
  );
}

// ── Role assignment row ─────────────────────────────────────────────────────────

interface RoleAssignRowProps {
  goalId: string;
  coverage: RoleCoverage;
  editing: boolean;
  saving: boolean;
  members: CapacityMember[];
  memberName: (id: string) => string;
  editUser: string;
  editPct: string;
  setEditUser: (v: string) => void;
  setEditPct: (v: string) => void;
  onStart: () => void;
  onSave: () => void;
  onCancel: () => void;
  onClear: () => void;
  readOnly?: boolean;
}

function RoleAssignRow({ coverage: c, editing, saving, members, memberName, editUser, editPct, setEditUser, setEditPct, onStart, onSave, onCancel, onClear, readOnly = false }: RoleAssignRowProps) {
  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5">
        <span className="text-[11px] font-bold text-slate-600 min-w-[44px]">{c.role}</span>
        <span className="text-[10px] text-slate-400">req {c.requiredPct}%</span>
        <select value={editUser} onChange={(e) => setEditUser(e.target.value)} className="ml-auto h-7 min-w-[130px] rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 outline-none">
          <option value="">— Pick person —</option>
          {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile.full_name}</option>)}
        </select>
        <Input type="number" min={10} max={100} step={10} value={editPct} onChange={(e) => setEditPct(e.target.value)} className="h-7 w-14 text-[11px] text-center px-1" />
        <button onClick={onSave} disabled={saving} className="flex h-7 items-center gap-1 rounded-md bg-indigo-600 px-2 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><Check className="h-3 w-3" /> Save</button>
        {c.assignment && <button onClick={onClear} className="flex h-7 w-7 items-center justify-center rounded-md border border-red-100 bg-red-50 text-red-500 hover:bg-red-100" title="Clear"><Trash2 className="h-3 w-3" /></button>}
        <button onClick={onCancel} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-slate-100" title="Cancel"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  if (!c.assignment) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-2.5 py-1.5">
        <span className="text-[11px] font-bold text-slate-600 min-w-[44px]">{c.role}</span>
        <span className="text-[10px] text-slate-400">req {c.requiredPct}%</span>
        <span className="ml-auto text-[11px] font-medium text-amber-700">Unassigned</span>
        {!readOnly && <button onClick={onStart} className="rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-600">Assign</button>}
      </div>
    );
  }

  const over = c.gap < 0;
  const under = c.gap > 0;
  const allocCls = over ? "text-red-600" : under ? "text-amber-600" : "text-indigo-600";
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${under || over ? "border-amber-200 bg-amber-50/40" : "border-slate-100 bg-slate-50"}`}>
      <span className="text-[11px] font-bold text-slate-600 min-w-[44px]">{c.role}</span>
      <span className="text-[10px] text-slate-400">req {c.requiredPct}%</span>
      <span className="ml-auto text-[11px] font-semibold text-slate-800">{memberName(c.assignment.user_id)}</span>
      <span className={`text-[11px] font-bold ${allocCls}`}>{c.assignedPct}%{(under || over) && " ⚠"}</span>
      {!readOnly && <button onClick={onStart} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100">Edit</button>}
    </div>
  );
}

function BulkRoleAssignRow({
  coverage: c,
  members,
  draft,
  onPatch,
}: {
  coverage: RoleCoverage;
  members: CapacityMember[];
  draft: RoleDraft | undefined;
  onPatch: (patch: Partial<RoleDraft>) => void;
}) {
  return (
    <div className="grid grid-cols-[70px_92px_minmax(150px,1fr)_82px] items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/30 px-2.5 py-1.5">
      <span className="text-[11px] font-bold text-slate-600">{c.role}</span>
      <div className="relative">
        <Input
          type="number"
          min={1}
          max={100}
          value={draft?.required_pct ?? String(c.requiredPct)}
          onChange={(e) => onPatch({ required_pct: e.target.value })}
          className="h-7 pr-5 text-right text-[11px]"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">%</span>
      </div>
      <select
        value={draft?.user_id ?? ""}
        onChange={(e) => onPatch({ user_id: e.target.value })}
        className="h-7 min-w-[130px] rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 outline-none"
      >
        <option value="">Unassigned</option>
        {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile.full_name}</option>)}
      </select>
      <div className="relative">
        <Input
          type="number"
          min={1}
          max={100}
          value={draft?.allocation_pct ?? String(c.assignedPct || c.requiredPct)}
          onChange={(e) => onPatch({ allocation_pct: e.target.value })}
          className="h-7 pr-5 text-right text-[11px]"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">%</span>
      </div>
    </div>
  );
}

// ── Add-role-to-goal inline control ─────────────────────────────────────────────

function AddRoleInline({ availableRoles, onAdd }: { availableRoles: readonly string[]; onAdd: (role: string, pct: number) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const [pct, setPct] = useState("");
  const [saving, setSaving] = useState(false);

  if (availableRoles.length === 0 && !open) return null;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700">
        <Plus className="h-3 w-3" /> Add role
      </button>
    );
  }

  async function handleAdd() {
    if (!role) { toast.error("Pick a role."); return; }
    const n = Number(pct);
    if (!Number.isFinite(n) || n <= 0 || n > 100) { toast.error("Enter a % between 1 and 100."); return; }
    setSaving(true);
    await onAdd(role, n);
    setSaving(false);
    setOpen(false); setRole(""); setPct("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/40 px-2.5 py-1.5">
      <select value={role} onChange={(e) => setRole(e.target.value)} className="h-7 min-w-[110px] rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-slate-700 outline-none">
        <option value="">Select role…</option>
        {availableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <div className="relative">
        <Input type="number" min={10} max={100} step={10} value={pct} onChange={(e) => setPct(e.target.value)} placeholder="%" className="h-7 w-16 text-[11px] text-right pr-4 px-1" />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">%</span>
      </div>
      <button onClick={handleAdd} disabled={saving} className="flex h-7 items-center gap-1 rounded-md bg-indigo-600 px-2 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><Check className="h-3 w-3" /> Add</button>
      <button onClick={() => { setOpen(false); setRole(""); setPct(""); }} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-slate-100" title="Cancel"><X className="h-3 w-3" /></button>
    </div>
  );
}

// ── Add member dialog ───────────────────────────────────────────────────────────

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sprint: { id: string };
  orgUsers: OrgUser[];
  existingIds: Set<string>;
  onAdded: (userId: string, role: string | null, expected: number | null) => void;
}

function AddMemberDialog({ open, onOpenChange, sprint, orgUsers, existingIds, onAdded }: AddMemberDialogProps) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [expected, setExpected] = useState("");
  const [saving, setSaving] = useState(false);

  const available = orgUsers.filter((u) => !existingIds.has(u.id));

  async function handleSave() {
    if (!userId) return toast.error("Pick a person to add.");
    setSaving(true);
    const expectedNum = expected.trim() === "" ? null : Math.max(0, Math.round(Number(expected)));
    const res = await addSprintMember({ sprintId: sprint.id, userId, role, expectedPoints: expectedNum });
    setSaving(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success("Member added.");
    onAdded(userId, role || null, expectedNum);
    setUserId(""); setRole(""); setExpected("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="text-base font-bold text-slate-900">Add Team Member</DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">Add a member to this sprint&apos;s capacity plan.</p>
        </DialogHeader>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Person <span className="text-red-500">*</span></label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400">
              <option value="">Select person…</option>
              {available.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            {available.length === 0 && <p className="text-[11px] text-slate-400 mt-1">All org members are already in this sprint.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400">
                <option value="">Select role…</option>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Expected Points</label>
              <Input type="number" min={0} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="e.g. 8" className="text-sm" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Expected points = this member&apos;s capacity for the sprint. Over/under-allocation is judged by comparing allocated points to this number.</p>
        </div>
        <DialogFooter className="mx-0 mb-0 border-t border-slate-100 bg-slate-50/50" showCloseButton>
          <Button onClick={handleSave} disabled={saving || !userId} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? "Adding…" : "Add Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
      <div className={`text-2xl font-extrabold leading-none ${color}`}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function gapBadge(coverage: RoleCoverage[]): { label: string; cls: string } {
  if (coverage.length === 0) return { label: "No roles", cls: "border-slate-200 bg-slate-50 text-slate-400" };
  const missing = coverage.filter((c) => c.gap > 0);
  const over = coverage.filter((c) => c.gap < 0);
  if (missing.length) return { label: `Missing ${missing.map((m) => `${m.gap}% ${m.role}`).join(", ")}`, cls: "border-red-200 bg-red-50 text-red-600" };
  if (over.length) return { label: `${over[0].role} over ${over[0].assignedPct}%`, cls: "border-amber-300 bg-amber-50 text-amber-700" };
  return { label: "Fully covered", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

function memberStatus(over: boolean, under: boolean, hasExpected: boolean): { label: string; cls: string } {
  if (!hasExpected) return { label: "No expectation", cls: "border-slate-200 bg-slate-50 text-slate-400" };
  if (over) return { label: "Over-allocated", cls: "border-red-200 bg-red-50 text-red-600" };
  if (under) return { label: "Under-utilized", cls: "border-amber-300 bg-amber-50 text-amber-700" };
  return { label: "Fully allocated", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}
