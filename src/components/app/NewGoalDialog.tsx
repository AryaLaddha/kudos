"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createGoal, updateGoal } from "@/app/(app)/sprints/goals-actions";
import type { CapacityRoleDefinition, SprintGoal, Stream } from "@/types";
import { toast } from "sonner";
import { Target, Plus, X } from "lucide-react";

interface RoleReqRow {
  id: string;
  role: string;
  points: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streams: Stream[];
  roles: CapacityRoleDefinition[];
  sprint: { id: string; start_date: string; end_date: string };
  goal?: SprintGoal | null;
  onSaved: (goal: SprintGoal) => void;
}

function makeRoleReqId(seed = "new") {
  return globalThis.crypto?.randomUUID?.() ?? `role_${seed}`;
}

function toRoleRows(goal: SprintGoal | null | undefined): RoleReqRow[] {
  return (goal?.role_requirements ?? []).map((r, index) => ({
    id: r.id || makeRoleReqId(`${goal?.id ?? "goal"}_${index}`),
    role: r.role,
    points: r.points !== null && r.points !== undefined ? String(r.points) : "",
  }));
}

export default function NewGoalDialog({ open, onOpenChange, streams, roles, sprint, goal, onSaved }: Props) {
  const editing = !!goal;
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [start, setStart] = useState(goal?.start_date ?? "");
  const [end, setEnd] = useState(goal?.end_date ?? "");
  const [points, setPoints] = useState<string>(goal?.points !== null && goal?.points !== undefined ? String(goal.points) : "");
  const [streamIds, setStreamIds] = useState<string[]>(goal?.stream_ids ?? []);
  const [tagsInput, setTagsInput] = useState((goal?.tags ?? []).join(", "));
  const [roleReqs, setRoleReqs] = useState<RoleReqRow[]>(toRoleRows(goal));
  const [isPending, startTransition] = useTransition();

  const activeStreams = streams.filter((s) => !s.is_archived || streamIds.includes(s.id));
  const activeRoles = roles.filter((r) => !r.is_archived || roleReqs.some((req) => req.role === r.name));

  function resetFromGoal(nextGoal: SprintGoal | null | undefined) {
    setTitle(nextGoal?.title ?? "");
    setDescription(nextGoal?.description ?? "");
    setStart(nextGoal?.start_date ?? "");
    setEnd(nextGoal?.end_date ?? "");
    setPoints(nextGoal?.points !== null && nextGoal?.points !== undefined ? String(nextGoal.points) : "");
    setStreamIds(nextGoal?.stream_ids ?? []);
    setTagsInput((nextGoal?.tags ?? []).join(", "));
    setRoleReqs(toRoleRows(nextGoal));
  }

  function toggleStream(id: string) {
    setStreamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addRoleRow() {
    setRoleReqs((prev) => [...prev, { id: makeRoleReqId(`new_${prev.length}`), role: "", points: "" }]);
  }

  function removeRoleRow(index: number) {
    setRoleReqs((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRoleRow(index: number, patch: Partial<RoleReqRow>) {
    setRoleReqs((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function handleSave() {
    const pts = points.trim() === "" ? null : Number(points);
    if (!title.trim()) return toast.error("Goal title is required.");
    if ((start && !end) || (!start && end)) return toast.error("Choose both start and end dates, or leave both blank.");
    if (pts !== null && (!Number.isFinite(pts) || pts <= 0)) return toast.error("Points must be a positive number.");

    for (const row of roleReqs) {
      if (!row.role) continue;
      if (row.points.trim() !== "") {
        const n = Number(row.points);
        if (!Number.isFinite(n) || n <= 0) return toast.error(`${row.role}: role points must be greater than 0.`);
      }
    }

    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const role_requirements = roleReqs
      .filter((r) => r.role)
      .map((r) => ({ id: r.id, role: r.role, points: r.points.trim() === "" ? null : Number(r.points) }));
    const payload = {
      title,
      description: description.trim() || null,
      points: pts,
      sprint_id: sprint.id,
      start_date: start || null,
      end_date: end || null,
      stream_ids: streamIds,
      tags,
      role_requirements,
    };

    startTransition(async () => {
      const result = editing ? await updateGoal(goal!.id, payload) : await createGoal(payload);
      if (result.error || !result.goal) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      toast.success(editing ? "Goal updated." : "Goal created.");
      onSaved(result.goal);
      if (!editing) resetFromGoal(null);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-full max-w-lg flex-col gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="border-b border-slate-100 px-5 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Target className="h-4 w-4 text-indigo-600" />
            {editing ? "Edit Sprint Goal" : "New Sprint Goal"}
          </DialogTitle>
          <p className="mt-0.5 text-xs text-slate-500">Goals appear in any sprint whose dates they overlap.</p>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Goal Title <span className="text-red-500">*</span></label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Launch Customer Portal v2" className="text-sm" autoFocus />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Description <span className="font-normal text-slate-400">(optional)</span></label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} placeholder="Add context, success criteria, or notes..." className="resize-none text-sm" />
            <p className="mt-1 text-right text-[10px] text-slate-400">{description.length}/500</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Start Date <span className="font-normal text-slate-400">(optional)</span></label>
              <Input type="date" value={start} max={end || undefined} onChange={(e) => { setStart(e.target.value); if (end && e.target.value > end) setEnd(e.target.value); }} className="text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">End Date <span className="font-normal text-slate-400">(optional)</span></label>
              <Input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className="text-sm" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Points <span className="font-normal text-slate-400">(optional)</span></label>
            <Input type="number" min={0.1} step="any" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="e.g. 5.5" className="w-32 text-sm" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Streams</label>
            {activeStreams.length === 0 ? (
              <p className="text-xs text-slate-400">No streams yet. Create them in the Streams tab.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {activeStreams.map((s) => {
                  const on = streamIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleStream(s.id)} className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Required Roles <span className="font-normal text-slate-400">(points auto-fill from goal points when blank)</span>
            </label>
            <div className="space-y-1.5">
              {roleReqs.map((row, i) => (
                <div key={row.id} className="grid grid-cols-[1fr_96px_32px] items-center gap-1.5">
                  <select value={row.role} onChange={(e) => updateRoleRow(i, { role: e.target.value })} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-400">
                    <option value="">Select role...</option>
                    {activeRoles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                  <div className="relative">
                    <Input type="number" min={0.1} step="any" value={row.points} onChange={(e) => updateRoleRow(i, { points: e.target.value })} placeholder="pts" className="h-8 pr-7 text-right text-xs" />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">pts</span>
                  </div>
                  <button type="button" onClick={() => removeRoleRow(i)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100" title="Remove role">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addRoleRow} disabled={activeRoles.length === 0} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" /> Add role
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Custom Tags <span className="font-normal text-slate-400">(comma-separated)</span></label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. Q1 initiative, high priority" className="text-sm" />
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 border-t border-slate-100 bg-slate-50/50" showCloseButton>
          <Button onClick={handleSave} disabled={isPending} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {isPending ? "Saving..." : editing ? "Save Changes" : "Create Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
