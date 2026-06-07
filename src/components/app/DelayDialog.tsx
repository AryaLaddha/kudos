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
import { markGoalDelayed } from "@/app/(app)/sprints/goals-actions";
import type { GoalDelay, SprintGoal } from "@/types";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: SprintGoal | null;
  sprint: { id: string };
  onSaved: (goal: SprintGoal, delay: GoalDelay) => void;
}

export default function DelayDialog({ open, onOpenChange, goal, sprint, onSaved }: Props) {
  const [subtaskId, setSubtaskId] = useState<string>("");
  const [newDue, setNewDue] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setSubtaskId("");
    setNewDue("");
    setReason("");
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function handleConfirm() {
    if (!goal) return;
    if (!reason.trim()) return toast.error("A reason is required.");
    startTransition(async () => {
      const result = await markGoalDelayed(goal.id, {
        sprintId: sprint.id,
        subtaskId: subtaskId || null,
        newDueDate: newDue || null,
        reason,
      });
      if (result.error || !result.goal || !result.delay) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      toast.success("Goal marked as delayed.");
      onSaved(result.goal, result.delay);
      handleClose(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Mark Goal as Delayed
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">This is permanently recorded in the goal&apos;s history. A reason is required.</p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Which subtask is causing the delay?</label>
            <select
              value={subtaskId}
              onChange={(e) => setSubtaskId(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">N/A — Goal-level delay</option>
              {(goal?.subtasks ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">New Due Date <span className="font-normal text-slate-400">(optional — extends the goal)</span></label>
            <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Reason for delay <span className="text-red-500">*</span></label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Describe why this goal is delayed and any blockers…"
              className="resize-none text-sm"
            />
            <p className="text-right text-[10px] text-slate-400 mt-1">{reason.length}/280</p>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 border-t border-slate-100 bg-slate-50/50" showCloseButton>
          <Button onClick={handleConfirm} disabled={isPending} variant="destructive">
            {isPending ? "Saving…" : "Confirm Delay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
