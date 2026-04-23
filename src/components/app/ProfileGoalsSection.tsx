"use client";

import { useState, useTransition } from "react";
import { Trophy, Plus, Trash2, CheckCircle2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { GoalDefinition, EnrichedUserGoal } from "@/types";
import { adminAddGoalForUser, adminDeleteGoal, deleteGoal } from "@/app/(app)/goals/actions";
import GoalsPicker from "@/components/app/GoalsPicker";
import { toast } from "sonner";

interface Props {
  initialGoals: EnrichedUserGoal[];
  isAdmin: boolean;
  isOwn: boolean;
  targetUserId: string;
  orgId: string;
  goalDefinitions: GoalDefinition[];
}

export default function ProfileGoalsSection({
  initialGoals,
  isAdmin,
  isOwn,
  targetUserId,
  orgId,
  goalDefinitions,
}: Props) {
  const [goals, setGoals] = useState(initialGoals);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = isAdmin ? await adminDeleteGoal(id) : await deleteGoal(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setGoals((prev) => prev.filter((g) => g.id !== id));
        toast.success("Goal removed.");
      }
      setDeletingId(null);
    });
  }

  function handleGoalAdded(goal: EnrichedUserGoal) {
    setGoals((prev) => [goal, ...prev]);
    toast.success("Achievement logged.");
  }

  const existingIds = goals.map((g) => g.goal_id);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-8 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Completed Goals
          </h2>
          {goals.length > 0 && (
            <span className="text-xs bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-full">
              {goals.length}
            </span>
          )}
        </div>
        {(isAdmin || isOwn) && (
          <Button
            size="sm"
            onClick={() => setPickerOpen(true)}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Goal
          </Button>
        )}
      </div>

      {/* List */}
      {goals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <Trophy className="mx-auto h-7 w-7 text-slate-200 mb-2" />
          <p className="text-sm text-slate-400">No achievements logged yet.</p>
          {isAdmin && (
            <p className="text-xs text-slate-400 mt-1">
              Use the button above to log one.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500">
                      {goal.category}
                    </span>
                    <span className="text-xs font-bold text-amber-500">
                      +{goal.points} pts
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 leading-snug">
                    {goal.title}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">{goal.description}</p>
                </div>
                {(isAdmin || isOwn) && (
                  <button
                    onClick={() => handleDelete(goal.id)}
                    disabled={deletingId === goal.id}
                    className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5 disabled:opacity-50"
                    title="Remove achievement"
                  >
                    {deletingId === goal.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin picker dialog */}
      {isAdmin && !isOwn && (
        <AdminGoalsPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          existingGoalIds={existingIds}
          targetUserId={targetUserId}
          orgId={orgId}
          onSuccess={handleGoalAdded}
          goalDefinitions={goalDefinitions}
        />
      )}

      {/* User picker dialog */}
      {isOwn && (
        <GoalsPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          status="achieved"
          orgId={orgId}
          onSuccess={handleGoalAdded}
          goalDefinitions={goalDefinitions}
        />
      )}
    </div>
  );
}

// ── Inline admin goals picker ─────────────────────────────────────────────────

interface PickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingGoalIds: string[];
  targetUserId: string;
  orgId: string;
  onSuccess: (goal: EnrichedUserGoal) => void;
  goalDefinitions: GoalDefinition[];
}

function AdminGoalsPicker({
  open,
  onOpenChange,
  existingGoalIds,
  targetUserId,
  orgId,
  onSuccess,
  goalDefinitions,
}: PickerProps) {
  const [selectedGoal, setSelectedGoal] = useState<GoalDefinition | null>(null);
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const existingSet = new Set(existingGoalIds);
  const searchLower = search.toLowerCase().trim();
  const allAdded = goalDefinitions.every((g) => existingSet.has(g.id));

  function handleClose(value: boolean) {
    if (!value) {
      setSelectedGoal(null);
      setDescription("");
      setSearch("");
    }
    onOpenChange(value);
  }

  function handleConfirm() {
    if (!selectedGoal || !description.trim()) return;

    startTransition(async () => {
      const result = await adminAddGoalForUser(
        targetUserId,
        selectedGoal.id,
        description.trim(),
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }

      const enriched: EnrichedUserGoal = {
        id: result.id!,
        user_id: targetUserId,
        org_id: orgId,
        goal_id: selectedGoal.id,
        status: "achieved",
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
            Log a Completed Goal
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a goal they&apos;ve completed, then describe how they achieved it.
          </p>
        </DialogHeader>

        {/* Search */}
        {!allAdded && (
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
        )}

        {/* Goal list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
          {allAdded ? (
            <p className="text-sm text-slate-500 text-center py-6">
              All available goals have been logged for this user.
            </p>
          ) : (
            Array.from(new Set(goalDefinitions.map(g => g.category))).map((cat) => {
              const catGoals = goalDefinitions.filter(
                (g) =>
                  g.category === cat &&
                  !existingSet.has(g.id) &&
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
                            <p
                              className={`text-sm leading-snug ${
                                isSelected
                                  ? "font-semibold text-indigo-900"
                                  : "text-slate-700"
                              }`}
                            >
                              {goal.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                            <span
                              className={`text-xs font-bold ${
                                isSelected ? "text-indigo-600" : "text-slate-400"
                              }`}
                            >
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
            })
          )}
          {!allAdded && searchLower && goalDefinitions.every(
            (g) => existingSet.has(g.id) || !g.title.toLowerCase().includes(searchLower)
          ) && (
            <p className="text-sm text-slate-500 text-center py-6">No goals match your search.</p>
          )}
        </div>

        {/* Description */}
        {selectedGoal && (
          <div className="px-5 pt-3 pb-1 border-t border-slate-100">
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              How did they achieve this?
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <Textarea
              placeholder="Briefly describe what they did…"
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
            {isPending ? "Saving…" : "Log Achievement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
