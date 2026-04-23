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
import { EnrichedUserGoal, GoalDefinition } from "@/types";
import { addGoal } from "@/app/(app)/goals/actions";
import { toast } from "sonner";
import { CheckCircle2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface GoalsPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: "aim" | "achieved";
  orgId: string;
  onSuccess: (goal: EnrichedUserGoal) => void;
  goalDefinitions: GoalDefinition[];
}

export default function GoalsPicker({
  open,
  onOpenChange,
  status,
  orgId,
  onSuccess,
  goalDefinitions,
}: GoalsPickerProps) {
  const [selectedGoal, setSelectedGoal] = useState<GoalDefinition | null>(null);
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const searchLower = search.toLowerCase().trim();

  function handleClose(value: boolean) {
    if (!value) {
      setSelectedGoal(null);
      setDescription("");
      setSearch("");
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
        id: result.id!,           // real DB-generated UUID
        user_id: "",
        org_id: orgId,
        goal_id: selectedGoal.id,
        status,
        description: description.trim(),
        created_at: result.created_at!,
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
        className="max-w-lg w-full p-0 gap-0 flex flex-col max-h-[85vh]"
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

        {/* Search */}
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search goals…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm h-9"
            />
          </div>
        </div>

        {/* Scrollable goal list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
          {Array.from(new Set(goalDefinitions.map(g => g.category))).map((cat) => {
            const catGoals = goalDefinitions.filter(
              (g) =>
                g.category === cat &&
                (!searchLower || g.title.toLowerCase().includes(searchLower)),
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

          {searchLower && goalDefinitions.every(
            (g) => !g.title.toLowerCase().includes(searchLower)
          ) && (
            <p className="text-sm text-slate-500 text-center py-6">No goals match your search.</p>
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

        <DialogFooter className="mx-0 mb-0 border-t border-slate-100 bg-slate-50/50" showCloseButton>
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
