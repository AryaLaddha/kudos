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
import { createGoal, updateGoal } from "@/app/(app)/sprints/goals-actions";
import { ROLE_OPTIONS } from "@/lib/sprintGoals";
import type { SprintGoal, Stream } from "@/types";
import { toast } from "sonner";
import { Target, Plus, X } from "lucide-react";

interface RoleReqRow {
  role: string;
  pct: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streams: Stream[];
  sprint: { start_date: string; end_date: string };
  goal?: SprintGoal | null;
  onSaved: (goal: SprintGoal) => void;
}

export default function NewGoalDialog({ open, onOpenChange, streams, sprint, goal, onSaved }: Props) {
  const editing = !!goal;
  const [title, setTitle] = useState(goal?.title ?? "");
  const [start, setStart] = useState(goal?.start_date ?? sprint.start_date);
  const [end, setEnd] = useState(goal?.end_date ?? sprint.end_date);
  const [points, setPoints] = useState<string>(goal ? String(goal.points) : "");
  const [streamIds, setStreamIds] = useState<string[]>(goal?.stream_ids ?? []);
  const [tagsInput, setTagsInput] = useState((goal?.tags ?? []).join(", "));
  const [roleReqs, setRoleReqs] = useState<RoleReqRow[]>(
    (goal?.role_requirements ?? []).map((r) => ({ role: r.role, pct: String(r.pct) })),
  );
  const [isPending, startTransition] = useTransition();

  const activeStreams = streams.filter((s) => !s.is_archived || streamIds.includes(s.id));

  function toggleStream(id: string) {
    setStreamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addRoleRow() {
    setRoleReqs((prev) => [...prev, { role: "", pct: "" }]);
  }
  function removeRoleRow(index: number) {
    setRoleReqs((prev) => prev.filter((_, i) => i !== index));
  }
  function updateRoleRow(index: number, patch: Partial<RoleReqRow>) {
    setRoleReqs((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function handleSave() {
    const pts = Number(points);
    if (!title.trim()) return toast.error("Goal title is required.");
    if (!start || !end) return toast.error("Start and end dates are required.");
    if (!Number.isFinite(pts) || pts <= 0) return toast.error("Points must be a positive number.");

    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const role_requirements = roleReqs
      .filter((r) => r.role && r.pct)
      .map((r) => ({ role: r.role, pct: Number(r.pct) }));
    const payload = { title, points: pts, start_date: start, end_date: end, stream_ids: streamIds, tags, role_requirements };

    startTransition(async () => {
      const result = editing ? await updateGoal(goal!.id, payload) : await createGoal(payload);
      if (result.error || !result.goal) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      toast.success(editing ? "Goal updated." : "Goal created.");
      onSaved(result.goal);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full p-0 gap-0 max-h-[88vh] flex flex-col" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Target className="h-4 w-4 text-indigo-600" />
            {editing ? "Edit Sprint Goal" : "New Sprint Goal"}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">Goals appear in any sprint whose dates they overlap.</p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Goal Title <span className="text-red-500">*</span></label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Launch Customer Portal v2" className="text-sm" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Start Date <span className="text-red-500">*</span></label>
              <Input type="date" value={start} max={end || undefined} onChange={(e) => { setStart(e.target.value); if (end && e.target.value > end) setEnd(e.target.value); }} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">End Date <span className="text-red-500">*</span></label>
              <Input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className="text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Points <span className="text-red-500">*</span></label>
            <Input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} placeholder="e.g. 5" className="text-sm w-32" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Streams</label>
            {activeStreams.length === 0 ? (
              <p className="text-xs text-slate-400">No streams yet — create them in the Streams tab.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {activeStreams.map((s) => {
                  const on = streamIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleStream(s.id)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${on ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"}`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Required Roles <span className="font-normal text-slate-400">(roles + % needed to complete this goal)</span>
            </label>
            <div className="space-y-1.5">
              {roleReqs.map((row, i) => {
                // Roles already chosen in other rows can't be picked again.
                const taken = new Set(roleReqs.filter((_, j) => j !== i).map((r) => r.role));
                return (
                  <div key={i} className="grid grid-cols-[1fr_84px_32px] gap-1.5 items-center">
                    <select
                      value={row.role}
                      onChange={(e) => updateRoleRow(i, { role: e.target.value })}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-400"
                    >
                      <option value="">Select role…</option>
                      {ROLE_OPTIONS.filter((r) => r === row.role || !taken.has(r)).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <Input
                        type="number"
                        min={10}
                        max={100}
                        step={10}
                        value={row.pct}
                        onChange={(e) => updateRoleRow(i, { pct: e.target.value })}
                        placeholder="%"
                        className="text-xs h-8 pr-5 text-right"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRoleRow(i)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100"
                      title="Remove role"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addRoleRow}
              disabled={roleReqs.length >= ROLE_OPTIONS.length}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Add role
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Custom Tags <span className="font-normal text-slate-400">(comma-separated)</span></label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. Q1 initiative, high priority" className="text-sm" />
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 border-t border-slate-100 bg-slate-50/50" showCloseButton>
          <Button onClick={handleSave} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isPending ? "Saving…" : editing ? "Save Changes" : "Create Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
