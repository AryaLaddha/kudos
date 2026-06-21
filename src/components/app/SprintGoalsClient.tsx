"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NewGoalDialog from "@/components/app/NewGoalDialog";
import DelayDialog from "@/components/app/DelayDialog";
import {
  completeGoal,
  deleteGoal,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  updateGoalsBulk,
} from "@/app/(app)/sprints/goals-actions";
import { GOAL_STATUS_META, GOAL_STATUSES, ROLE_OPTIONS, colorForId } from "@/lib/sprintGoals";
import { formatDateRange, formatShortDate } from "@/lib/leave";
import type { GoalStatus, RoleRequirement, SprintGoal, Stream } from "@/types";
import { toast } from "sonner";
import {
  Plus, ChevronDown, Trash2, AlertTriangle, CheckCircle2, Circle, Pencil, CalendarDays, ListChecks, Save, X,
} from "lucide-react";

interface OrgUser { id: string; full_name: string; }
interface Props {
  goals: SprintGoal[];
  setGoals: React.Dispatch<React.SetStateAction<SprintGoal[]>>;
  streams: Stream[];
  sprint: { id: string; start_date: string; end_date: string };
  orgUsers: OrgUser[];
}

const NO_STREAM = "__none__";

type GoalDraft = {
  title: string;
  description: string;
  points: string;
  start_date: string;
  end_date: string;
  status: GoalStatus;
  stream_ids: string[];
  tags: string;
  role_requirements: string;
};

function roleRequirementsText(reqs: RoleRequirement[]) {
  return reqs.map((r) => `${r.role}:${r.pct}`).join(", ");
}

function goalPointsLabel(points: number | null) {
  return points === null || points === undefined ? "No pts" : String(points);
}

function goalDateLabel(goal: Pick<SprintGoal, "start_date" | "end_date">) {
  if (!goal.start_date || !goal.end_date) return "No dates";
  return formatDateRange(goal.start_date, goal.end_date);
}

function parseRoleRequirements(value: string): RoleRequirement[] | string {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const validRoles = new Set<string>(ROLE_OPTIONS);
  const seen = new Set<string>();
  const out: RoleRequirement[] = [];

  for (const part of trimmed.split(",")) {
    const [roleRaw, pctRaw] = part.split(":").map((s) => s?.trim());
    if (!roleRaw || !pctRaw) return "Use role requirements like Dev:50, QA:50.";
    if (!validRoles.has(roleRaw)) return `${roleRaw} is not a valid role.`;
    if (seen.has(roleRaw)) return `${roleRaw} is listed more than once.`;
    const pct = Math.round(Number(pctRaw));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return "Role percentages must be between 1 and 100.";
    seen.add(roleRaw);
    out.push({ role: roleRaw, pct });
  }
  return out;
}

export default function SprintGoalsClient({ goals, setGoals, streams, sprint, orgUsers }: Props) {
  const [streamFilter, setStreamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pointsFilter, setPointsFilter] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [newDialogKey, setNewDialogKey] = useState(0);
  const [editGoal, setEditGoal] = useState<SprintGoal | null>(null);
  const [delayGoal, setDelayGoal] = useState<SprintGoal | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkSaving, startBulkSave] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, GoalDraft>>({});

  const userName = useMemo(() => {
    const m = new Map(orgUsers.map((u) => [u.id, u.full_name]));
    return (id: string | null) => (id ? m.get(id) ?? "Someone" : "Someone");
  }, [orgUsers]);

  const filtered = useMemo(() => {
    return goals.filter((g) => {
      if (streamFilter !== "all" && !g.stream_ids.includes(streamFilter)) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      const points = g.points;
      if (pointsFilter !== "all" && (points === null || points === undefined)) return false;
      if (pointsFilter === "1-3" && points !== null && !(points >= 1 && points <= 3)) return false;
      if (pointsFilter === "4-6" && points !== null && !(points >= 4 && points <= 6)) return false;
      if (pointsFilter === "7+" && points !== null && !(points >= 7)) return false;
      return true;
    });
  }, [goals, streamFilter, statusFilter, pointsFilter]);

  // Group the filtered goals by their first stream (unstreamed → "Other").
  const grouped = useMemo(() => {
    const byStream = new Map<string, SprintGoal[]>();
    for (const g of filtered) {
      const key = g.stream_ids[0] ?? NO_STREAM;
      if (!byStream.has(key)) byStream.set(key, []);
      byStream.get(key)!.push(g);
    }
    const ordered: { key: string; label: string; goals: SprintGoal[] }[] = [];
    for (const s of streams) {
      if (byStream.has(s.id)) ordered.push({ key: s.id, label: s.name, goals: byStream.get(s.id)! });
    }
    if (byStream.has(NO_STREAM)) ordered.push({ key: NO_STREAM, label: "Other", goals: byStream.get(NO_STREAM)! });
    return ordered;
  }, [filtered, streams]);

  // ── Mutations (optimistic-ish: apply returned rows to local state) ──
  function upsertGoal(goal: SprintGoal) {
    setGoals((prev) => (prev.some((g) => g.id === goal.id) ? prev.map((g) => (g.id === goal.id ? goal : g)) : [goal, ...prev]));
  }
  function patchGoal(id: string, patch: Partial<SprintGoal>) {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function startEditAll() {
    setDrafts(Object.fromEntries(goals.map((g) => [g.id, {
      title: g.title,
      description: g.description ?? "",
      points: g.points !== null && g.points !== undefined ? String(g.points) : "",
      start_date: g.start_date ?? "",
      end_date: g.end_date ?? "",
      status: g.status,
      stream_ids: g.stream_ids,
      tags: g.tags.join(", "),
      role_requirements: roleRequirementsText(g.role_requirements ?? []),
    } satisfies GoalDraft])));
    setBulkEditing(true);
  }

  function cancelEditAll() {
    setBulkEditing(false);
    setDrafts({});
  }

  function patchDraft(id: string, patch: Partial<GoalDraft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function toggleDraftStream(goalId: string, streamId: string) {
    setDrafts((prev) => {
      const current = prev[goalId]?.stream_ids ?? [];
      const next = current.includes(streamId) ? current.filter((id) => id !== streamId) : [...current, streamId];
      return { ...prev, [goalId]: { ...prev[goalId], stream_ids: next } };
    });
  }

  function saveEditAll() {
    const updates = goals.map((goal) => {
      const draft = drafts[goal.id];
      if (!draft) return null;
      const points = draft.points.trim() === "" ? null : Number(draft.points);
      const roleReqs = parseRoleRequirements(draft.role_requirements);
      if (typeof roleReqs === "string") {
        toast.error(`${goal.title}: ${roleReqs}`);
        return "invalid";
      }
      if ((draft.start_date && !draft.end_date) || (!draft.start_date && draft.end_date)) {
        toast.error(`${goal.title}: choose both start and end dates, or leave both blank.`);
        return "invalid";
      }
      if (points !== null && (!Number.isFinite(points) || points <= 0)) {
        toast.error(`${goal.title}: points must be a positive number.`);
        return "invalid";
      }
      return {
        id: goal.id,
        title: draft.title,
        description: draft.description,
        points,
        start_date: draft.start_date || null,
        end_date: draft.end_date || null,
        stream_ids: draft.stream_ids,
        tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
        role_requirements: roleReqs,
        status: draft.status,
      };
    });
    if (updates.includes("invalid")) return;
    const cleanUpdates = updates.filter(Boolean) as Exclude<(typeof updates)[number], null | "invalid">[];

    startBulkSave(async () => {
      const res = await updateGoalsBulk(sprint.id, cleanUpdates);
      if (res.error || !res.goals) { toast.error(res.error ?? "Couldn't save goals."); return; }
      setGoals((prev) => prev.map((g) => res.goals!.find((saved) => saved.id === g.id) ?? g));
      setBulkEditing(false);
      setDrafts({});
      toast.success("All sprint goals saved.");
    });
  }

  return (
    <div>
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
        <select value={pointsFilter} onChange={(e) => setPointsFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 outline-none">
          <option value="all">All Points</option>
          <option value="1-3">1–3 pts</option>
          <option value="4-6">4–6 pts</option>
          <option value="7+">7+ pts</option>
        </select>
        <div className="flex-1" />
        {bulkEditing ? (
          <>
            <Button size="sm" variant="outline" onClick={cancelEditAll} disabled={bulkSaving} className="h-8 gap-1.5 text-xs px-3">
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={saveEditAll} disabled={bulkSaving} className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3">
              <Save className="h-3.5 w-3.5" /> {bulkSaving ? "Saving..." : "Save all"}
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={startEditAll} disabled={goals.length === 0} className="h-8 gap-1.5 text-xs px-3">
              <Pencil className="h-3.5 w-3.5" /> Edit all
            </Button>
            <Button size="sm" onClick={() => { setNewDialogKey((k) => k + 1); setNewOpen(true); }} className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3">
              <Plus className="h-3.5 w-3.5" /> New Goal
            </Button>
          </>
        )}
      </div>

      {/* Goal list */}
      {bulkEditing ? (
        <BulkGoalsEditor
          grouped={grouped}
          drafts={drafts}
          streams={streams}
          onPatch={patchDraft}
          onToggleStream={toggleDraftStream}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <ListChecks className="mx-auto h-8 w-8 text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-400">{goals.length === 0 ? "No goals in this sprint window yet." : "No goals match your filters."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.key}>
              <div className="flex items-center gap-2 mb-2.5">
                {group.key !== NO_STREAM && (
                  <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: colorForId(group.key) }}>
                    {group.label}
                  </span>
                )}
                <h3 className="text-sm font-bold text-slate-800">{group.label} Goals</h3>
                <span className="text-[11px] font-semibold text-slate-400">{group.goals.length}</span>
              </div>
              <div className="space-y-3">
                {group.goals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    expanded={expanded.has(goal.id)}
                    onToggleExpand={() => toggleExpand(goal.id)}
                    userName={userName}
                    onEdit={() => setEditGoal(goal)}
                    onDelay={() => setDelayGoal(goal)}
                    onComplete={upsertGoal}
                    onDeleted={(id) => setGoals((prev) => prev.filter((g) => g.id !== id))}
                    patchGoal={patchGoal}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewGoalDialog key={newDialogKey} open={newOpen} onOpenChange={setNewOpen} streams={streams} sprint={sprint} onSaved={upsertGoal} />
      {editGoal && (
        <NewGoalDialog
          key={editGoal.id}
          open={!!editGoal}
          onOpenChange={(v) => !v && setEditGoal(null)}
          streams={streams}
          sprint={sprint}
          goal={editGoal}
          onSaved={upsertGoal}
        />
      )}
      <DelayDialog
        open={!!delayGoal}
        onOpenChange={(v) => !v && setDelayGoal(null)}
        goal={delayGoal}
        sprint={sprint}
        onSaved={(g) => { upsertGoal(g); setDelayGoal(null); }}
      />
    </div>
  );
}

function BulkGoalsEditor({
  grouped,
  drafts,
  streams,
  onPatch,
  onToggleStream,
}: {
  grouped: { key: string; label: string; goals: SprintGoal[] }[];
  drafts: Record<string, GoalDraft>;
  streams: Stream[];
  onPatch: (id: string, patch: Partial<GoalDraft>) => void;
  onToggleStream: (goalId: string, streamId: string) => void;
}) {
  if (grouped.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <ListChecks className="mx-auto h-8 w-8 text-slate-200 mb-2" />
        <p className="text-sm font-medium text-slate-400">No goals match your filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.key}>
          <div className="flex items-center gap-2 mb-2.5">
            {group.key !== NO_STREAM && (
              <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: colorForId(group.key) }}>
                {group.label}
              </span>
            )}
            <h3 className="text-sm font-bold text-slate-800">{group.label} Goals</h3>
            <span className="text-[11px] font-semibold text-slate-400">{group.goals.length}</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5 w-[300px]">Goal</th>
                  <th className="px-3 py-2.5 w-[86px]">Points</th>
                  <th className="px-3 py-2.5 w-[250px]">Dates</th>
                  <th className="px-3 py-2.5 w-[130px]">Status</th>
                  <th className="px-3 py-2.5 w-[220px]">Streams</th>
                  <th className="px-3 py-2.5 w-[210px]">Tags</th>
                  <th className="px-3 py-2.5 w-[210px]">Roles</th>
                </tr>
              </thead>
              <tbody>
                {group.goals.map((goal) => {
                  const draft = drafts[goal.id];
                  if (!draft) return null;
                  const activeStreams = streams.filter((s) => !s.is_archived || draft.stream_ids.includes(s.id));

                  return (
                    <tr key={goal.id} className="border-b border-slate-100 last:border-b-0 align-top">
                      <td className="px-3 py-3">
                        <div className="space-y-1.5">
                          <Input value={draft.title} onChange={(e) => onPatch(goal.id, { title: e.target.value })} maxLength={120} className="h-8 text-xs" />
                          <Input value={draft.description} onChange={(e) => onPatch(goal.id, { description: e.target.value })} maxLength={500} placeholder="Optional description" className="h-8 text-xs" />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Input type="number" min={1} value={draft.points} onChange={(e) => onPatch(goal.id, { points: e.target.value })} className="h-8 text-xs" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="grid grid-cols-2 gap-1.5">
                          <Input type="date" value={draft.start_date} max={draft.end_date || undefined} onChange={(e) => onPatch(goal.id, { start_date: e.target.value, end_date: draft.end_date && e.target.value > draft.end_date ? e.target.value : draft.end_date })} className="h-8 text-xs" />
                          <Input type="date" value={draft.end_date} min={draft.start_date || undefined} onChange={(e) => onPatch(goal.id, { end_date: e.target.value })} className="h-8 text-xs" />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <select value={draft.status} onChange={(e) => onPatch(goal.id, { status: e.target.value as GoalStatus })} className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none">
                          {GOAL_STATUSES.map((s) => <option key={s} value={s}>{GOAL_STATUS_META[s].label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        {activeStreams.length === 0 ? (
                          <span className="text-[11px] text-slate-400">No streams</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {activeStreams.map((stream) => {
                              const on = draft.stream_ids.includes(stream.id);
                              return (
                                <button
                                  key={stream.id}
                                  type="button"
                                  onClick={() => onToggleStream(goal.id, stream.id)}
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300"}`}
                                >
                                  {stream.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Input value={draft.tags} onChange={(e) => onPatch(goal.id, { tags: e.target.value })} placeholder="tag, tag" className="h-8 text-xs" />
                      </td>
                      <td className="px-3 py-3">
                        <Input value={draft.role_requirements} onChange={(e) => onPatch(goal.id, { role_requirements: e.target.value })} placeholder="Dev:50, QA:50" className="h-8 text-xs" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-slate-400">Role format: Dev:50, QA:50. Leaving roles blank removes required roles for that goal.</p>
    </div>
  );
}

// ── Goal card ─────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: SprintGoal;
  expanded: boolean;
  onToggleExpand: () => void;
  userName: (id: string | null) => string;
  onEdit: () => void;
  onDelay: () => void;
  onComplete: (goal: SprintGoal) => void;
  onDeleted: (id: string) => void;
  patchGoal: (id: string, patch: Partial<SprintGoal>) => void;
}

function GoalCard({ goal, expanded, onToggleExpand, userName, onEdit, onDelay, onComplete, onDeleted, patchGoal }: GoalCardProps) {
  const [isPending, startTransition] = useTransition();
  const [newSubtask, setNewSubtask] = useState("");
  const [newSubDue, setNewSubDue] = useState("");

  const status = GOAL_STATUS_META[goal.status];
  const isCompleted = goal.status === "completed";
  const extended = !!goal.end_date && !!goal.original_end_date && goal.end_date > goal.original_end_date;
  const subtasks = goal.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.is_done).length;
  const latestDelay = (goal.delays ?? [])[0];

  function handleComplete() {
    startTransition(async () => {
      const res = await completeGoal(goal.id, !isCompleted);
      if (res.error || !res.goal) { toast.error(res.error ?? "Something went wrong."); return; }
      onComplete(res.goal);
      toast.success(isCompleted ? "Goal reopened." : "Goal completed.");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteGoal(goal.id);
      if (res.error) { toast.error(res.error); return; }
      onDeleted(goal.id);
      toast.success("Goal deleted.");
    });
  }

  function handleAddSubtask() {
    const name = newSubtask.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await addSubtask(goal.id, name, newSubDue || null);
      if (res.error || !res.subtask) { toast.error(res.error ?? "Something went wrong."); return; }
      patchGoal(goal.id, { subtasks: [...subtasks, res.subtask] });
      setNewSubtask("");
      setNewSubDue("");
    });
  }

  function handleToggleSubtask(id: string, isDone: boolean) {
    patchGoal(goal.id, { subtasks: subtasks.map((s) => (s.id === id ? { ...s, is_done: isDone } : s)) });
    startTransition(async () => {
      const res = await toggleSubtask(id, isDone);
      if (res.error) toast.error(res.error);
    });
  }

  function handleDeleteSubtask(id: string) {
    startTransition(async () => {
      const res = await deleteSubtask(id);
      if (res.error) { toast.error(res.error); return; }
      patchGoal(goal.id, { subtasks: subtasks.filter((s) => s.id !== id) });
    });
  }

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${goal.status === "delayed" ? "border-red-200" : "border-slate-100"}`}>
      <div className="flex items-start gap-3 p-4">
        {/* Points badge */}
        <div className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 flex-shrink-0 ${isCompleted ? "bg-blue-50 text-blue-700" : "bg-indigo-50 text-indigo-700"}`}>
          <span className="text-lg font-extrabold leading-none">{goalPointsLabel(goal.points)}</span>
          {goal.points !== null && goal.points !== undefined && <span className="text-[9px] font-semibold uppercase tracking-wide">pts</span>}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-bold ${isCompleted ? "line-through text-slate-400" : "text-slate-900"}`}>{goal.title}</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: status.pillBg, color: status.pillText }}>{status.label}</span>
            {goal.tags.map((t) => (
              <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{t}</span>
            ))}
          </div>
          {goal.description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{goal.description}</p>
          )}
          <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> {goalDateLabel(goal)}
              {extended && goal.original_end_date && <span className="text-amber-600"> (extended from {formatShortDate(goal.original_end_date)})</span>}
            </span>
            {subtasks.length > 0 && <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> {doneCount}/{subtasks.length} subtasks</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isCompleted && (
            <Button size="sm" variant="outline" onClick={handleComplete} disabled={isPending} className="h-7 px-2.5 text-[11px] gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              <CheckCircle2 className="h-3.5 w-3.5" /> Complete
            </Button>
          )}
          {!isCompleted && (
            <Button size="sm" variant="outline" onClick={onDelay} className="h-7 px-2.5 text-[11px] gap-1 text-red-600 border-red-200 hover:bg-red-50">
              <AlertTriangle className="h-3.5 w-3.5" /> Delay
            </Button>
          )}
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Edit goal"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onToggleExpand} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" title="Toggle subtasks">
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          <button onClick={handleDelete} disabled={isPending} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50" title="Delete goal"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Required roles */}
      {(goal.role_requirements ?? []).length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Required Roles</p>
          <div className="flex flex-wrap gap-1.5">
            {goal.role_requirements.map((r) => (
              <span key={r.role} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {r.role} <span className="text-indigo-600 font-bold">{r.pct}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Delay strip */}
      {latestDelay && (
        <div className="flex items-start gap-2 border-t border-red-100 bg-red-50/60 px-4 py-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-red-800">
            <span className="italic">&ldquo;{latestDelay.reason}&rdquo;</span>
            <div className="text-red-500/80 mt-0.5">
              Reported by {userName(latestDelay.reported_by)}
              {latestDelay.new_due_date && <> · New due {formatShortDate(latestDelay.new_due_date)}</>}
            </div>
          </div>
        </div>
      )}

      {/* Subtasks */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Subtasks</p>
          <div className="space-y-1.5">
            {subtasks.map((s) => (
              <div key={s.id} className="group flex items-center gap-2 rounded-lg bg-white border border-slate-100 px-2.5 py-1.5">
                <button onClick={() => handleToggleSubtask(s.id, !s.is_done)} className="flex-shrink-0">
                  {s.is_done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-slate-300" />}
                </button>
                <span className={`flex-1 text-xs ${s.is_done ? "line-through text-slate-400" : "text-slate-700"}`}>{s.name}</span>
                {s.due_date && <span className="text-[10px] text-slate-400">Due {formatShortDate(s.due_date)}</span>}
                <button onClick={() => handleDeleteSubtask(s.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); }} placeholder="Add a subtask…" className="text-xs h-8 flex-1" />
            <Input type="date" value={newSubDue} onChange={(e) => setNewSubDue(e.target.value)} className="text-xs h-8 w-36" />
            <Button size="sm" onClick={handleAddSubtask} disabled={isPending || !newSubtask.trim()} className="h-8 px-2.5 text-xs bg-slate-700 hover:bg-slate-800 text-white">Add</Button>
          </div>
        </div>
      )}
    </div>
  );
}
