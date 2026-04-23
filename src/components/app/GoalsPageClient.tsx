"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EnrichedUserGoal } from "@/types";
import { deleteGoal } from "@/app/(app)/goals/actions";
import GoalsPicker from "@/components/app/GoalsPicker";
import AchievementCelebration from "@/components/app/AchievementCelebration";
import { toast } from "sonner";
import { Trophy, Target, Plus, Trash2, Star } from "lucide-react";

interface GoalsPageClientProps {
  achievedGoals: EnrichedUserGoal[];
  aimGoals: EnrichedUserGoal[];
  totalPoints: number;
  orgId: string;
  goalDefinitions: any[];
}

export default function GoalsPageClient({
  achievedGoals: initialAchieved,
  aimGoals: initialAim,
  totalPoints: initialPoints,
  orgId,
  goalDefinitions,
}: GoalsPageClientProps) {
  const router = useRouter();
  const [achievedGoals, setAchievedGoals] = useState(initialAchieved);
  const [aimGoals, setAimGoals] = useState(initialAim);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStatus, setPickerStatus] = useState<"aim" | "achieved">("achieved");
  const [celebration, setCelebration] = useState<EnrichedUserGoal | null>(null);
  const [deletingId, startDeleteTransition] = useTransition();

  const totalPoints = achievedGoals.reduce((sum, g) => sum + g.points, 0);

  function openPicker(status: "aim" | "achieved") {
    setPickerStatus(status);
    setPickerOpen(true);
  }

  function handleGoalAdded(goal: EnrichedUserGoal) {
    if (goal.status === "achieved") {
      setAchievedGoals((prev) => [goal, ...prev]);
      setCelebration(goal);
    } else {
      setAimGoals((prev) => [goal, ...prev]);
    }
  }

  function handleCelebrationDismiss() {
    setCelebration(null);
    router.refresh();
  }

  function handleDelete(id: string, status: "aim" | "achieved") {
    startDeleteTransition(async () => {
      const result = await deleteGoal(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (status === "achieved") {
        setAchievedGoals((prev) => prev.filter((g) => g.id !== id));
      } else {
        setAimGoals((prev) => prev.filter((g) => g.id !== id));
      }
    });
  }


  return (
    <>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
              <Target className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Goals</h1>
              <p className="text-sm text-slate-500">Track your personal achievements</p>
            </div>
          </div>

          {/* Total points badge */}
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 flex-shrink-0">
            <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
            <span className="text-sm font-extrabold text-amber-700">
              {totalPoints} pts achieved
            </span>
          </div>
        </div>

        {/* ── Achieved Goals ────────────────────────────────── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                Achieved Goals
              </h2>
            </div>
            <Button
              size="sm"
              onClick={() => openPicker("achieved")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 gap-1.5 text-xs px-3"
            >
              <Plus className="h-3.5 w-3.5" />
              Log Achievement
            </Button>
          </div>

          {achievedGoals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <Trophy className="mx-auto h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm font-medium text-slate-400">No achievements logged yet</p>
              <p className="text-xs text-slate-400 mt-1">Hit a goal? Log it here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {achievedGoals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onDelete={() => handleDelete(goal.id, "achieved")}
                  variant="achieved"
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Goals Aim ─────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                Goals Aim
              </h2>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openPicker("aim")}
              className="h-8 gap-1.5 text-xs px-3 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Goal
            </Button>
          </div>

          {aimGoals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <Target className="mx-auto h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm font-medium text-slate-400">No goals set yet</p>
              <p className="text-xs text-slate-400 mt-1">Add goals you're working towards.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {aimGoals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onDelete={() => handleDelete(goal.id, "aim")}
                  variant="aim"
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Picker modal */}
      <GoalsPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        status={pickerStatus}
        orgId={orgId}
        onSuccess={handleGoalAdded}
        goalDefinitions={goalDefinitions}
      />

      {/* Achievement celebration overlay */}
      {celebration && (
        <AchievementCelebration
          goal={celebration}
          onDismiss={handleCelebrationDismiss}
        />
      )}
    </>
  );
}

// ── GoalRow ────────────────────────────────────────────────────

interface GoalRowProps {
  goal: EnrichedUserGoal;
  onDelete: () => void;
  variant: "achieved" | "aim";
}

function GoalRow({ goal, onDelete, variant }: GoalRowProps) {
  return (
    <div
      className={`group flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm transition-shadow hover:shadow-md ${
        variant === "achieved"
          ? "bg-white border-slate-100"
          : "bg-white border-slate-100"
      }`}
    >
      {/* Status icon */}
      <div
        className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
          variant === "achieved"
            ? "bg-green-100 text-green-600"
            : "bg-indigo-50 text-indigo-400"
        }`}
      >
        {variant === "achieved" ? (
          <Trophy className="h-3.5 w-3.5" />
        ) : (
          <Target className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 leading-snug">
          {goal.title}
        </p>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          {goal.description}
        </p>
        <p className="mt-1 text-[10px] text-slate-400 uppercase tracking-wide">
          {goal.category}
        </p>
      </div>

      {/* Points + delete */}
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <span
          className={`text-xs font-bold ${
            variant === "achieved" ? "text-indigo-600" : "text-slate-400"
          }`}
        >
          {goal.points} pts
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50"
          aria-label="Delete goal"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
