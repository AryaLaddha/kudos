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
import type { SprintGoal, Stream } from "@/types";
import { toast } from "sonner";
import { Target } from "lucide-react";

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
  const [isPending, startTransition] = useTransition();

  const activeStreams = streams.filter((s) => !s.is_archived || streamIds.includes(s.id));

  function toggleStream(id: string) {
    setStreamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSave() {
    const pts = Number(points);
    if (!title.trim()) return toast.error("Goal title is required.");
    if (!start || !end) return toast.error("Start and end dates are required.");
    if (!Number.isFinite(pts) || pts <= 0) return toast.error("Points must be a positive number.");

    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = { title, points: pts, start_date: start, end_date: end, stream_ids: streamIds, tags };

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
              <p className="text-xs text-slate-400">No streams yet — create them from the Capacity tab.</p>
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
