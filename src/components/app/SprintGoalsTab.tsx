"use client";

import { useMemo, useState, useTransition } from "react";
import NewGoalDialog from "@/components/app/NewGoalDialog";
import DelayDialog from "@/components/app/DelayDialog";
import {
  addSubtask, completeGoal, deleteGoal, deleteSubtask, toggleSubtask,
} from "@/app/(app)/sprints/goals-actions";
import { addGoalNote } from "@/app/(app)/sprints/planning-actions";
import { GOAL_STATUS_META, GOAL_STATUSES, formatRolePoints, goalRoleCoverage, overlapsSprint } from "@/lib/sprintGoals";
import { formatDateRange, formatShortDate } from "@/lib/leave";
import type { CapacityRoleDefinition, GoalAssignment, GoalNote, GoalStatus, SprintGoal, SprintRef, Stream } from "@/types";
import { toast } from "sonner";

interface OrgUser { id: string; full_name: string }
interface Props {
  goals: SprintGoal[];
  setGoals: React.Dispatch<React.SetStateAction<SprintGoal[]>>;
  assignments: GoalAssignment[];
  streams: Stream[];
  roles: CapacityRoleDefinition[];
  sprint: { id: string; start_date: string; end_date: string };
  allSprints: SprintRef[];
  orgUsers: OrgUser[];
  notes: GoalNote[];
  onNoteAdded: (note: GoalNote) => void;
}

const PILL: Record<GoalStatus, string> = { on_track: "p-ok", delayed: "p-bad", completed: "p-done", carried_over: "p-hold" };
const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
const r1 = (n: number) => Math.round(n * 100) / 100;

export default function SprintGoalsTab({ goals, setGoals, assignments, streams, roles, sprint, allSprints, orgUsers, notes, onNoteAdded }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [streamFilter, setStreamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [newKey, setNewKey] = useState(0);
  const [editGoal, setEditGoal] = useState<SprintGoal | null>(null);
  const [delayGoal, setDelayGoal] = useState<SprintGoal | null>(null);
  const [newSubtask, setNewSubtask] = useState("");
  const [newNote, setNewNote] = useState("");

  const userName = useMemo(() => {
    const m = new Map(orgUsers.map((u) => [u.id, u.full_name]));
    return (id: string | null) => (id ? m.get(id) ?? "Someone" : "Someone");
  }, [orgUsers]);
  const streamName = useMemo(() => new Map(streams.map((s) => [s.id, s.name])), [streams]);

  // A goal is "carried" when it was already running in an earlier sprint.
  const earlier = useMemo(() => allSprints.filter((s) => s.end_date < sprint.start_date), [allSprints, sprint.start_date]);
  const isCarried = (g: SprintGoal) => earlier.some((s) => overlapsSprint(g, s));

  const plannedByGoal = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assignments) m.set(a.goal_id, (m.get(a.goal_id) ?? 0) + (a.allocated_points || 0));
    return m;
  }, [assignments]);
  const peopleByGoal = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of assignments) m.set(a.goal_id, [...new Set([...(m.get(a.goal_id) ?? []), a.user_id])]);
    return m;
  }, [assignments]);

  const filtered = goals.filter((g) => {
    if (streamFilter !== "all" && !g.stream_ids.includes(streamFilter)) return false;
    if (statusFilter !== "all" && g.status !== statusFilter) return false;
    return true;
  });
  const selected = goals.find((g) => g.id === selectedId) ?? filtered[0] ?? null;

  function upsertGoal(goal: SprintGoal) {
    setGoals((prev) => (prev.some((g) => g.id === goal.id) ? prev.map((g) => (g.id === goal.id ? goal : g)) : [goal, ...prev]));
    setSelectedId(goal.id);
  }
  function patchGoal(id: string, patch: Partial<SprintGoal>) {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function handleComplete(g: SprintGoal) {
    const done = g.status === "completed";
    startTransition(async () => {
      const res = await completeGoal(g.id, !done);
      if (res.error || !res.goal) { toast.error(res.error ?? "Something went wrong."); return; }
      upsertGoal(res.goal);
      toast.success(done ? "Goal reopened." : "Goal completed.");
    });
  }
  function handleDelete(g: SprintGoal) {
    if (!confirm(`Delete "${g.title}"? This removes its subtasks, notes and assignments.`)) return;
    startTransition(async () => {
      const res = await deleteGoal(g.id);
      if (res.error) { toast.error(res.error); return; }
      setGoals((prev) => prev.filter((x) => x.id !== g.id));
      setSelectedId(null);
      toast.success("Goal deleted.");
    });
  }
  function handleAddSubtask(g: SprintGoal) {
    const name = newSubtask.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await addSubtask(g.id, name, null);
      if (res.error || !res.subtask) { toast.error(res.error ?? "Something went wrong."); return; }
      patchGoal(g.id, { subtasks: [...(g.subtasks ?? []), res.subtask] });
      setNewSubtask("");
    });
  }
  function handleToggleSubtask(g: SprintGoal, id: string, isDone: boolean) {
    patchGoal(g.id, { subtasks: (g.subtasks ?? []).map((s) => (s.id === id ? { ...s, is_done: isDone } : s)) });
    startTransition(async () => {
      const res = await toggleSubtask(id, isDone);
      if (res.error) toast.error(res.error);
    });
  }
  function handleDeleteSubtask(g: SprintGoal, id: string) {
    startTransition(async () => {
      const res = await deleteSubtask(id);
      if (res.error) { toast.error(res.error); return; }
      patchGoal(g.id, { subtasks: (g.subtasks ?? []).filter((s) => s.id !== id) });
    });
  }
  function handleAddNote(g: SprintGoal) {
    const body = newNote.trim();
    if (!body) return;
    startTransition(async () => {
      const res = await addGoalNote(g.id, body);
      if (res.error || !res.note) { toast.error(res.error ?? "Something went wrong."); return; }
      onNoteAdded(res.note);
      setNewNote("");
    });
  }

  return (
    <div className="sp-screen">
      <div className="sp-toolbar">
        <select className="sp-select" aria-label="Filter by stream" value={streamFilter} onChange={(e) => setStreamFilter(e.target.value)}>
          <option value="all">All streams</option>
          {streams.filter((s) => !s.is_archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="sp-select" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {GOAL_STATUSES.map((s) => <option key={s} value={s}>{GOAL_STATUS_META[s].label}</option>)}
        </select>
        <span className="note">{filtered.length} of {goals.length} goals</span>
      </div>

      <div className="sp-grid sp-g-2">
        <div className="sp-panel">
          <h2>
            Sprint goals
            <button className="sp-btn primary sm" onClick={() => { setNewKey((k) => k + 1); setNewOpen(true); }}>+ New goal</button>
          </h2>
          {filtered.length === 0 ? (
            <div className="sp-empty">{goals.length === 0 ? "No goals overlap this sprint yet. Create one to get started." : "No goals match these filters."}</div>
          ) : (
            <div className="sp-tw">
              <table>
                <thead><tr><th>Goal</th><th>Stream</th><th>Status</th><th>People</th><th>Planned</th></tr></thead>
                <tbody>
                  {filtered.map((g) => {
                    const subs = g.subtasks ?? [];
                    const donePct = subs.length ? Math.round((subs.filter((s) => s.is_done).length / subs.length) * 100) : g.status === "completed" ? 100 : 0;
                    const people = peopleByGoal.get(g.id) ?? [];
                    return (
                      <tr key={g.id} className={`clk${selected?.id === g.id ? " sel" : ""}`} tabIndex={0}
                        onClick={() => setSelectedId(g.id)} onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(g.id); }}>
                        <td>
                          <b>{g.title}</b>{isCarried(g) && <> <span className="sp-tag carry">Carried</span></>}
                          <div className="sp-pbar"><i style={{ width: `${donePct}%` }} /></div>
                        </td>
                        <td>{g.stream_ids.map((id) => streamName.get(id)).filter(Boolean).join(", ") || <span className="note">None</span>}</td>
                        <td><span className={`sp-pill ${PILL[g.status]}`}>{GOAL_STATUS_META[g.status].label}</span></td>
                        <td>
                          {people.length ? (
                            <div className="sp-stack">{people.slice(0, 4).map((id) => <span key={id} className="sp-avatar" title={userName(id)}>{initials(userName(id))}</span>)}</div>
                          ) : g.status === "completed" ? <span className="note">—</span> : <span className="sp-pill p-bad">None</span>}
                        </td>
                        <td className="mono">{r1(plannedByGoal.get(g.id) ?? 0).toFixed(1)}{g.points ? <span className="note"> / {g.points}</span> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="sp-panel">
          {!selected ? (
            <div className="sp-empty">Select a goal to see its roles, subtasks and notes.</div>
          ) : (
            renderDetail()
          )}
        </div>
      </div>

      <NewGoalDialog key={newKey} open={newOpen} onOpenChange={setNewOpen} streams={streams} roles={roles} sprint={sprint} onSaved={upsertGoal} />
      {editGoal && (
        <NewGoalDialog key={editGoal.id} open onOpenChange={(v) => !v && setEditGoal(null)} streams={streams} roles={roles} sprint={sprint} goal={editGoal} onSaved={upsertGoal} />
      )}
      <DelayDialog open={!!delayGoal} onOpenChange={(v) => !v && setDelayGoal(null)} goal={delayGoal} sprint={sprint} onSaved={(g) => { upsertGoal(g); setDelayGoal(null); }} />
    </div>
  );

  function renderDetail() {
    const g = selected!;
    const coverage = goalRoleCoverage(g, assignments);
    const subs = g.subtasks ?? [];
    const goalNotes = notes.filter((n) => n.goal_id === g.id);
    const latestDelay = g.delays?.[0];
    const done = g.status === "completed";
    const planned = r1(plannedByGoal.get(g.id) ?? 0);
    return (
      <>
        <h2>
          <span>{g.title}</span>
          <span className={`sp-pill ${PILL[g.status]}`}>{GOAL_STATUS_META[g.status].label}</span>
        </h2>
        {g.description && <p className="note" style={{ margin: "0 0 8px" }}>{g.description}</p>}
        <div className="sp-diff"><span>Stream</span><b>{g.stream_ids.map((id) => streamName.get(id)).filter(Boolean).join(", ") || "None"}</b></div>
        <div className="sp-diff"><span>Dates</span><b>{g.start_date && g.end_date ? formatDateRange(g.start_date, g.end_date) : "Unscheduled"}</b></div>
        {g.original_end_date && g.end_date && g.end_date > g.original_end_date && (
          <div className="sp-diff"><span>Extended from</span><b>{formatShortDate(g.original_end_date)}</b></div>
        )}
        <div className="sp-diff"><span>Goal points</span><b className="mono">{g.points ?? "—"}</b></div>
        <div className="sp-diff"><span>Planned points</span><b className="mono">{planned}</b></div>

        <div className="sp-sub-h">Roles needed</div>
        {coverage.length === 0 ? (
          <span className="note">No roles yet. Edit the goal to add the roles it needs, then allocate people in Capacity &amp; allocation.</span>
        ) : (
          coverage.map((c) => (
            <div key={c.id} className="sp-diff">
              <span>{c.role} <span className="note">{formatRolePoints(c.requiredPoints)}</span></span>
              <b>
                {c.assignment ? `${userName(c.assignment.user_id)} · ${c.assignedPoints} pts` : <span className="sp-pill p-bad">Unassigned</span>}
              </b>
            </div>
          ))
        )}

        {latestDelay && (
          <div className="sp-delay">
            <b>Delayed:</b> &ldquo;{latestDelay.reason}&rdquo;
            <div className="note">Reported by {userName(latestDelay.reported_by)}{latestDelay.new_due_date && <> · new due {formatShortDate(latestDelay.new_due_date)}</>}</div>
          </div>
        )}

        <div className="sp-sub-h">Subtasks {subs.length > 0 && `(${subs.filter((s) => s.is_done).length}/${subs.length})`}</div>
        {subs.map((s) => (
          <div key={s.id} className={`sp-sub${s.is_done ? " done" : ""}`}>
            <input type="checkbox" checked={s.is_done} onChange={(e) => handleToggleSubtask(g, s.id, e.target.checked)} aria-label={`Mark ${s.name} done`} />
            <span style={{ flex: 1 }}>{s.name}</span>
            {s.due_date && <span className="note">Due {formatShortDate(s.due_date)}</span>}
            <button className="t" aria-label="Delete subtask" onClick={() => handleDeleteSubtask(g, s.id)}>×</button>
          </div>
        ))}
        <div className="sp-compose">
          <input className="sp-input" aria-label="New subtask" placeholder="Add a subtask" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(g); }} />
          <button className="sp-btn" disabled={isPending || !newSubtask.trim()} onClick={() => handleAddSubtask(g)}>Add</button>
        </div>

        <div className="sp-sub-h">Notes</div>
        <div className="sp-log">
          {goalNotes.length === 0 && <span className="note">No notes yet.</span>}
          {goalNotes.map((n) => (
            <div key={n.id} className="e">
              <span className="when">{new Date(n.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
              <span><b>{userName(n.author_id)}</b><br />{n.body}</span>
            </div>
          ))}
        </div>
        <div className="sp-compose">
          <input className="sp-input" aria-label="New note" placeholder="Add a dated note" maxLength={1000} value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(g); }} />
          <button className="sp-btn primary" disabled={isPending || !newNote.trim()} onClick={() => handleAddNote(g)}>Add</button>
        </div>

        <div className="sp-addrow" style={{ marginTop: 16 }}>
          <button className="sp-btn" disabled={isPending} onClick={() => handleComplete(g)}>{done ? "Reopen" : "Complete"}</button>
          {!done && <button className="sp-btn danger" onClick={() => setDelayGoal(g)}>Mark delayed</button>}
          <button className="sp-btn" onClick={() => setEditGoal(g)}>Edit</button>
          <button className="sp-btn danger" disabled={isPending} onClick={() => handleDelete(g)}>Delete</button>
        </div>
      </>
    );
  }
}
