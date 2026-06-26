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
import { GOAL_STATUS_META, GOAL_STATUSES, colorForId, formatRolePoints } from "@/lib/sprintGoals";
import { formatDateRange, formatShortDate } from "@/lib/leave";
import type { CapacityRoleDefinition, GoalStatus, RoleRequirement, SprintGoal, Stream } from "@/types";
import { toast } from "sonner";
import {
  Plus, ChevronDown, Trash2, AlertTriangle, CheckCircle2, Circle, Pencil, CalendarDays, ListChecks, Save, X, LayoutGrid, Table2,
} from "lucide-react";

interface OrgUser { id: string; full_name: string; }
interface Props {
  goals: SprintGoal[];
  setGoals: React.Dispatch<React.SetStateAction<SprintGoal[]>>;
  streams: Stream[];
  roles: CapacityRoleDefinition[];
  sprint: { id: string; start_date: string; end_date: string };
  orgUsers: OrgUser[];
}

const NO_STREAM = "__none__";
type ViewMode = "cards" | "table";

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
  return reqs.map((r) => `${r.role}:${r.points ?? ""}`).join(", ");
}

function goalPointsLabel(points: number | null) {
  return points === null || points === undefined ? "No pts" : formatPointValue(points);
}

function formatPointValue(points: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(points);
}

function goalDateLabel(goal: Pick<SprintGoal, "start_date" | "end_date">) {
  if (!goal.start_date || !goal.end_date) return "No dates";
  return formatDateRange(goal.start_date, goal.end_date);
}

function parseRoleRequirements(value: string, validRoleNames: string[]): RoleRequirement[] | string {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const validRoles = new Set<string>(validRoleNames);
  const out: RoleRequirement[] = [];

  for (const part of trimmed.split(",")) {
    const [roleRaw, pointsRaw = ""] = part.split(":").map((s) => s?.trim());
    if (!roleRaw) return "Use role requirements like Dev:5, QA:3.";
    if (!validRoles.has(roleRaw)) return `${roleRaw} is not a valid role.`;
    const points = pointsRaw === "" ? null : Number(pointsRaw);
    if (points !== null && (!Number.isFinite(points) || points <= 0)) return "Role points must be greater than 0.";
    out.push({ id: globalThis.crypto?.randomUUID?.() ?? `${roleRaw}_${out.length}`, role: roleRaw, points });
  }
  return out;
}

export default function SprintGoalsClient({ goals, setGoals, streams, roles, sprint, orgUsers }: Props) {
  const [streamFilter, setStreamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pointsFilter, setPointsFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
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
  const streamName = useMemo(() => {
    const m = new Map(streams.map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? "Stream";
  }, [streams]);
  const activeRoleNames = useMemo(() => roles.filter((r) => !r.is_archived).map((r) => r.name), [roles]);

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

  const goalStats = useMemo(() => {
    const totalPoints = filtered.reduce((sum, g) => sum + (g.points ?? 0), 0);
    return {
      totalGoals: filtered.length,
      totalPoints: Math.round(totalPoints * 100) / 100,
      completed: filtered.filter((g) => g.status === "completed").length,
      delayed: filtered.filter((g) => g.status === "delayed").length,
      unscheduled: filtered.filter((g) => !g.start_date || !g.end_date).length,
    };
  }, [filtered]);

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
      const roleReqs = parseRoleRequirements(draft.role_requirements, activeRoleNames);
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Stat label="Total Goals" value={goalStats.totalGoals} color="text-indigo-600" />
        <Stat label="Total Points" value={formatPointValue(goalStats.totalPoints)} color="text-emerald-600" />
        <Stat label="Completed" value={goalStats.completed} color="text-blue-600" />
        <Stat label="Delayed" value={goalStats.delayed} color="text-red-600" />
        <Stat label="No Dates" value={goalStats.unscheduled} color="text-amber-600" />
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
        <select value={pointsFilter} onChange={(e) => setPointsFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 outline-none">
          <option value="all">All Points</option>
          <option value="1-3">1–3 pts</option>
          <option value="4-6">4–6 pts</option>
          <option value="7+">7+ pts</option>
        </select>
        <div className="flex-1" />
        <div className="inline-flex h-8 rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold ${viewMode === "cards" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold ${viewMode === "table" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Table2 className="h-3.5 w-3.5" /> Table
          </button>
        </div>
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
          roles={roles}
          onPatch={patchDraft}
          onToggleStream={toggleDraftStream}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <ListChecks className="mx-auto h-8 w-8 text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-400">{goals.length === 0 ? "No goals in this sprint window yet." : "No goals match your filters."}</p>
        </div>
      ) : viewMode === "table" ? (
        <GoalTableView
          grouped={grouped}
          streamName={streamName}
          onEdit={setEditGoal}
          onDelay={setDelayGoal}
          onComplete={upsertGoal}
          onDeleted={(id) => setGoals((prev) => prev.filter((g) => g.id !== id))}
        />
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

      <NewGoalDialog key={newDialogKey} open={newOpen} onOpenChange={setNewOpen} streams={streams} roles={roles} sprint={sprint} onSaved={upsertGoal} />
      {editGoal && (
        <NewGoalDialog
          key={editGoal.id}
          open={!!editGoal}
          onOpenChange={(v) => !v && setEditGoal(null)}
          streams={streams}
          roles={roles}
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

function GoalTableView({
  grouped,
  streamName,
  onEdit,
  onDelay,
  onComplete,
  onDeleted,
}: {
  grouped: { key: string; label: string; goals: SprintGoal[] }[];
  streamName: (id: string) => string;
  onEdit: (goal: SprintGoal) => void;
  onDelay: (goal: SprintGoal) => void;
  onComplete: (goal: SprintGoal) => void;
  onDeleted: (id: string) => void;
}) {
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
                  <th className="px-3 py-2.5 w-[90px] text-center">Points</th>
                  <th className="px-3 py-2.5 w-[150px]">Dates</th>
                  <th className="px-3 py-2.5 w-[120px]">Status</th>
                  <th className="px-3 py-2.5">Streams / Tags</th>
                  <th className="px-3 py-2.5 w-[160px]">Roles</th>
                  <th className="px-3 py-2.5 w-[150px]">Progress</th>
                  <th className="px-3 py-2.5 w-[170px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.goals.map((goal) => (
                  <GoalTableRow
                    key={goal.id}
                    goal={goal}
                    streamName={streamName}
                    onEdit={() => onEdit(goal)}
                    onDelay={() => onDelay(goal)}
                    onComplete={onComplete}
                    onDeleted={onDeleted}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function GoalTableRow({
  goal,
  streamName,
  onEdit,
  onDelay,
  onComplete,
  onDeleted,
}: {
  goal: SprintGoal;
  streamName: (id: string) => string;
  onEdit: () => void;
  onDelay: () => void;
  onComplete: (goal: SprintGoal) => void;
  onDeleted: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const status = GOAL_STATUS_META[goal.status];
  const subtasks = goal.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.is_done).length;
  const isCompleted = goal.status === "completed";

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

  return (
    <tr className="border-b border-slate-100 last:border-b-0 align-top hover:bg-slate-50/50">
      <td className="px-3 py-3">
        <div className="text-xs font-bold text-slate-900">{goal.title}</div>
        {goal.description && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{goal.description}</p>}
      </td>
      <td className="px-3 py-3 text-center">
        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-extrabold text-indigo-700">{goalPointsLabel(goal.points)}</span>
      </td>
      <td className="px-3 py-3 text-[11px] text-slate-500">{goalDateLabel(goal)}</td>
      <td className="px-3 py-3">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: status.pillBg, color: status.pillText }}>{status.label}</span>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {goal.stream_ids.length === 0 && goal.tags.length === 0 && <span className="text-[11px] text-slate-400">—</span>}
          {goal.stream_ids.map((sid) => (
            <span key={sid} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: colorForId(sid) }}>{streamName(sid)}</span>
          ))}
          {goal.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{tag}</span>
          ))}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {(goal.role_requirements ?? []).length === 0 ? (
            <span className="text-[11px] text-slate-400">No roles</span>
          ) : goal.role_requirements.map((r) => (
            <span key={r.id} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{r.role} {formatRolePoints(r.points)}</span>
          ))}
        </div>
      </td>
      <td className="px-3 py-3 text-[11px] text-slate-500">
        {subtasks.length > 0 ? `${doneCount}/${subtasks.length} subtasks` : "No subtasks"}
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-1">
          {!isCompleted && (
            <>
              <Button size="sm" variant="outline" onClick={handleComplete} disabled={isPending} className="h-7 px-2 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50">Done</Button>
              <Button size="sm" variant="outline" onClick={onDelay} className="h-7 px-2 text-[11px] text-red-600 border-red-200 hover:bg-red-50">Delay</Button>
            </>
          )}
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Edit goal"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={handleDelete} disabled={isPending} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50" title="Delete goal"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </td>
    </tr>
  );
}

function BulkGoalsEditor({
  grouped,
  drafts,
  streams,
  roles,
  onPatch,
  onToggleStream,
}: {
  grouped: { key: string; label: string; goals: SprintGoal[] }[];
  drafts: Record<string, GoalDraft>;
  streams: Stream[];
  roles: CapacityRoleDefinition[];
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
                        <Input type="number" min={0.1} step="any" value={draft.points} onChange={(e) => onPatch(goal.id, { points: e.target.value })} className="h-8 text-xs" />
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
                        <Input value={draft.role_requirements} onChange={(e) => onPatch(goal.id, { role_requirements: e.target.value })} placeholder="Dev:5, Dev:8, QA:3" className="h-8 text-xs" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-slate-400">Role format: Dev:5, Dev:8, QA:3. Blank points auto-fill from the goal points. Active roles: {roles.filter((r) => !r.is_archived).map((r) => r.name).join(", ") || "none"}.</p>
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
              <span key={r.id} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {r.role} <span className="text-indigo-600 font-bold">{formatRolePoints(r.points)}</span>
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

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
      <div className={`text-2xl font-extrabold leading-none ${color}`}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-1">{label}</div>
    </div>
  );
}
