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
import { Textarea } from "@/components/ui/textarea";
import { GOALS, GOAL_CATEGORIES, GoalDefinition } from "@/lib/goals";
import { EnrichedUserGoal } from "@/types";
import { addGoal } from "@/app/(app)/goals/actions";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

interface GoalsPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: "aim" | "achieved";
  existingGoalIds: string[]; // goal_ids already in this bucket
  orgId: string;
  onSuccess: (goal: EnrichedUserGoal) => void;
}

export default function GoalsPicker({
  open,
  onOpenChange,
  status,
  existingGoalIds,
  orgId,
  onSuccess,
}: GoalsPickerProps) {
  const [selectedGoal, setSelectedGoal] = useState<GoalDefinition | null>(null);
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  const existingSet = new Set(existingGoalIds);

  function handleClose(value: boolean) {
    if (!value) {
      setSelectedGoal(null);
      setDescription("");
    }
    onOpenChange(value);
  }

  function handleConfirm() {
    if (!selectedGoal) return;
    if (!description.trim()) {
      toast.error("Please add a description before saving.");
      return;
    }

    startTransition(async () => {
      const result = await addGoal(selectedGoal.id, status, description, orgId);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      const enriched: EnrichedUserGoal = {
        id: crypto.randomUUID(),
        user_id: "",
        org_id: orgId,
        goal_id: selectedGoal.id,
        status,
        description: description.trim(),
        created_at: new Date().toISOString(),
        title: selectedGoal.title,
        category: selectedGoal.category,
        points: selectedGoal.points,
      };

      handleClose(false);
      onSuccess(enriched);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-lg w-full p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="text-base font-bold text-slate-900">
            {status === "achieved" ? "Log an Achievement" : "Add a Goal to Aim For"}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            {status === "achieved"
              ? "Select a goal you've completed, then describe how you achieved it."
              : "Pick a goal you're working towards and note your intention."}
          </p>
        </DialogHeader>

        {/* Scrollable goal list */}
        <div className="overflow-y-auto max-h-72 px-3 py-3 space-y-3">
          {GOAL_CATEGORIES.map((cat) => {
            const catGoals = GOALS.filter(
              (g) => g.category === cat && !existingSet.has(g.id),
            );
            if (catGoals.length === 0) return null;

            return (
              <div key={cat}>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {cat}
                </p>
                <div className="space-y-1">
                  {catGoals.map((goal) => {
                    const isSelected = selectedGoal?.id === goal.id;
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => setSelectedGoal(goal)}
                        className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors flex items-start gap-3 ${
                          isSelected
                            ? "bg-indigo-50 ring-1 ring-indigo-300"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${isSelected ? "font-semibold text-indigo-900" : "text-slate-700"}`}>
                            {goal.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                          <span className={`text-xs font-bold ${isSelected ? "text-indigo-600" : "text-slate-400"}`}>
                            {goal.points} pts
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {GOAL_CATEGORIES.every(
            (cat) =>
              GOALS.filter(
                (g) => g.category === cat && !existingSet.has(g.id),
              ).length === 0,
          ) && (
            <p className="text-sm text-slate-500 text-center py-6">
              You've added all available goals in this section.
            </p>
          )}
        </div>

        {/* Description — shown once a goal is selected */}
        {selectedGoal && (
          <div className="px-5 pt-3 pb-1 border-t border-slate-100">
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              {status === "achieved" ? "How did you achieve this?" : "What's your plan?"}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <Textarea
              placeholder={
                status === "achieved"
                  ? "Briefly describe what you did…"
                  : "Describe what you're aiming for…"
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="resize-none text-sm"
              autoFocus
            />
            <p className="text-right text-[10px] text-slate-400 mt-1">
              {description.length}/500
            </p>
          </div>
        )}

        <DialogFooter className="border-t border-slate-100 bg-slate-50/50" showCloseButton>
          <Button
            onClick={handleConfirm}
            disabled={!selectedGoal || !description.trim() || isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isPending
              ? "Saving…"
              : status === "achieved"
              ? "Log Achievement"
              : "Add to Goals Aim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
