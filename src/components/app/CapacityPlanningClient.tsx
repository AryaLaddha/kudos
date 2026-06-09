"use client";

import { useMemo, useState } from "react";
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
  assignmentAllocationTotal,
  assignmentExpectedPoints,
  colorForId,
  goalRoleCoverage,
  GOAL_STATUS_META,
  ROLE_OPTIONS,
  type RoleCoverage,
} from "@/lib/sprintGoals";
import { assignRole, unassignRole, addSprintMember } from "@/app/(app)/sprints/goals-actions";
import { formatDateRange } from "@/lib/leave";
import type { GoalAssignment, SprintGoal, Stream } from "@/types";
import { Pencil, Users, Plus, X, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CapacityMember {
  user_id: string;
  role: string | null;
  expected_override: number | null;
  manual_deducted_points: number;
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
}

function initials(n: string) {
  return n.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

const NO_STREAM = "__none__";

export default function CapacityPlanningClient({
  sprint, participants, goals, streams, assignments, setAssignments, orgUsers,
  onPatchParticipant, onMemberUpserted, onRemoveMember,
}: Props) {
  const [editing, setEditing] = useState<CapacityMember | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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

  // Per-member derived capacity figures.
  const rows = useMemo(() => {
    return participants.map((p) => {
      const userAssignments = assignmentsByUser.get(p.user_id) ?? [];
      const auto = assignmentExpectedPoints(userAssignments, goalsById);
      const expected = p.expected_override ?? auto;
      const deducted = p.manual_deducted_points ?? 0;
      const allocTotal = assignmentAllocationTotal(userAssignments);
      return {
        member: p,
        userAssignments,
        auto,
        expected,
        deducted,
        net: Math.round((expected - deducted) * 10) / 10,
        allocTotal,
        over: allocTotal > 100,
      };
    });
  }, [participants, assignmentsByUser, goalsById]);

  const rowByUser = useMemo(() => new Map(rows.map((r) => [r.member.user_id, r])), [rows]);

  const stats = useMemo(() => {
    const members = rows.length;
    const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
    const totalDeducted = rows.reduce((s, r) => s + r.deducted, 0);
    const avgAlloc = members ? Math.round(rows.reduce((s, r) => s + r.allocTotal, 0) / members) : 0;
    return {
      members,
      totalExpected: Math.round(totalExpected * 10) / 10,
      totalDeducted,
      net: Math.round((totalExpected - totalDeducted) * 10) / 10,
      avgAlloc,
    };
  }, [rows]);

  // Goals grouped by their first stream (unstreamed goals fall under "Other").
  const streamGroups = useMemo(() => {
    const byStream = new Map<string, SprintGoal[]>();
    for (const g of goals) {
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
  }, [goals, streams]);

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

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Stat label="Team Members" value={stats.members} color="text-indigo-600" />
        <Stat label="Total Exp. Points" value={stats.totalExpected} color="text-emerald-600" />
        <Stat label="Total Ded. Points" value={stats.totalDeducted} color="text-red-600" />
        <Stat label="Net Capacity" value={stats.net} color="text-slate-800" />
        <Stat label="Avg Allocation" value={`${stats.avgAlloc}%`} color="text-sky-600" />
      </div>

      {/* ── Per-stream goal / role tables ── */}
      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-400">No goals in this sprint window to staff.</p>
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
                          {coverage.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">No required roles set — edit the goal to add them.</p>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {coverage.map((c) => (
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
                                />
                              ))}
                            </div>
                          )}
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
          <Button size="sm" onClick={() => setAddOpen(true)} className="h-7 gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] px-2.5">
            <Plus className="h-3.5 w-3.5" /> Add Member
          </Button>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No members yet — add people to the capacity plan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Member</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5 text-center">Capacity</th>
                  <th className="px-4 py-2.5">Points by Goal</th>
                  <th className="px-4 py-2.5 text-center w-[130px]">Alloc %</th>
                  <th className="px-4 py-2.5 text-center">Net Pts</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 w-[70px]"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = memberStatus(r.allocTotal);
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
                        {r.member.role
                          ? <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{r.member.role}</span>
                          : <span className="text-[11px] text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-base font-extrabold text-indigo-600 leading-none">{r.expected}</div>
                        <div className="text-[10px] text-slate-400">exp pts</div>
                        {r.deducted > 0 && <div className="text-[10px] text-red-500 mt-0.5">−{r.deducted} ded</div>}
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
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${r.over ? "bg-gradient-to-r from-red-500 to-red-400" : "bg-gradient-to-r from-indigo-500 to-indigo-400"}`} style={{ width: `${Math.min(r.allocTotal, 100)}%` }} />
                          </div>
                          <span className={`text-xs font-bold ${r.over ? "text-red-600" : "text-indigo-600"}`}>{r.allocTotal}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-extrabold ${r.net < 0 ? "text-red-600" : "text-slate-900"}`}>{r.net}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditing(r.member)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Edit member"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => onRemoveMember(r.member.user_id)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50" title="Remove from sprint"><Trash2 className="h-3.5 w-3.5" /></button>
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
          autoExpected={rowByUser.get(editing.user_id)?.auto ?? 0}
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
}

function RoleAssignRow({ coverage: c, editing, saving, members, memberName, editUser, editPct, setEditUser, setEditPct, onStart, onSave, onCancel, onClear }: RoleAssignRowProps) {
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
        <button onClick={onStart} className="rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-600">Assign</button>
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
      <button onClick={onStart} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100">Edit</button>
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
              <Input type="number" min={0} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="auto" className="text-sm" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Leave Expected Points blank to auto-compute from assigned goals × allocation %.</p>
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

function memberStatus(allocTotal: number): { label: string; cls: string } {
  if (allocTotal > 100) return { label: "Over-allocated", cls: "border-red-200 bg-red-50 text-red-600" };
  if (allocTotal === 0) return { label: "No assignments", cls: "border-slate-200 bg-slate-50 text-slate-400" };
  if (allocTotal < 50) return { label: "Under-utilized", cls: "border-slate-200 bg-slate-100 text-slate-500" };
  return { label: "Allocated", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}
