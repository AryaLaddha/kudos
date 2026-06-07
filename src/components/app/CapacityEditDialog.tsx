"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateParticipantCapacity } from "@/app/(app)/sprints/goals-actions";
import { autoExpectedPoints, colorForId, totalAllocation } from "@/lib/sprintGoals";
import type { SprintGoal, Stream } from "@/types";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";

export interface CapParticipant {
  user_id: string;
  goal_allocations: Record<string, number>;
  expected_override: number | null;
  manual_deducted_points: number;
  stream_ids: string[];
  profile: { full_name: string };
}

export interface CapacityPatch {
  goal_allocations: Record<string, number>;
  expected_override: number | null;
  manual_deducted_points: number;
  stream_ids: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint: { id: string };
  participant: CapParticipant;
  goals: SprintGoal[];
  streams: Stream[];
  leaveDays: number;
  onSaved: (patch: CapacityPatch) => void;
}

export default function CapacityEditDialog({ open, onOpenChange, sprint, participant, goals, streams, leaveDays, onSaved }: Props) {
  const [allocations, setAllocations] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(participant.goal_allocations ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [overrideInput, setOverrideInput] = useState(
    participant.expected_override !== null && participant.expected_override !== undefined ? String(participant.expected_override) : "",
  );
  const [manualDed, setManualDed] = useState(String(participant.manual_deducted_points ?? 0));
  const [streamIds, setStreamIds] = useState<string[]>(participant.stream_ids ?? []);
  const [isPending, startTransition] = useTransition();

  const goalsById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const numericAllocations = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, val] of Object.entries(allocations)) {
      const n = Number(val);
      if (Number.isFinite(n) && n > 0) out[id] = n;
    }
    return out;
  }, [allocations]);

  const allocTotal = totalAllocation(numericAllocations);
  const auto = autoExpectedPoints(numericAllocations, goalsById);
  const overAllocated = allocTotal > 100;

  function setAlloc(goalId: string, value: string) {
    setAllocations((prev) => ({ ...prev, [goalId]: value }));
  }
  function toggleStream(id: string) {
    setStreamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSave() {
    const override = overrideInput.trim() === "" ? null : Math.max(0, Math.round(Number(overrideInput)));
    if (override !== null && !Number.isFinite(override)) return toast.error("Expected override must be a number.");
    const patch: CapacityPatch = {
      goal_allocations: numericAllocations,
      expected_override: override,
      manual_deducted_points: Math.max(0, Math.round(Number(manualDed) || 0)),
      stream_ids: streamIds,
    };
    startTransition(async () => {
      const res = await updateParticipantCapacity(sprint.id, participant.user_id, patch);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Capacity updated.");
      onSaved(patch);
      onOpenChange(false);
    });
  }

  const activeStreams = streams.filter((s) => !s.is_archived || streamIds.includes(s.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full p-0 gap-0 max-h-[88vh] flex flex-col" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <SlidersHorizontal className="h-4 w-4 text-indigo-600" /> {participant.profile.full_name}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">Set allocation, expected points, deductions and streams.</p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-5 overflow-y-auto">
          {/* Allocations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Allocation across goals</label>
              <span className={`text-xs font-bold ${overAllocated ? "text-red-600" : "text-slate-500"}`}>{allocTotal}%{overAllocated && " ⚠"}</span>
            </div>
            {goals.length === 0 ? (
              <p className="text-xs text-slate-400">No goals in this sprint window to allocate to.</p>
            ) : (
              <div className="space-y-1.5">
                {goals.map((g) => (
                  <div key={g.id} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: colorForId(g.id) }} />
                    <span className="flex-1 min-w-0 truncate text-xs text-slate-600">{g.title}</span>
                    <span className="text-[10px] text-slate-400">{g.points} pts</span>
                    <div className="relative w-20 flex-shrink-0">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={allocations[g.id] ?? ""}
                        onChange={(e) => setAlloc(g.id, e.target.value)}
                        placeholder="0"
                        className="text-xs h-8 pr-5 text-right"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {overAllocated && <p className="mt-1.5 text-[11px] text-red-600">Over-allocated by {allocTotal - 100}% — consider reducing.</p>}
          </div>

          {/* Expected / Deducted */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 block mb-1.5">Expected points</label>
              <Input type="number" min={0} value={overrideInput} onChange={(e) => setOverrideInput(e.target.value)} placeholder={`auto: ${auto}`} className="text-sm" />
              <p className="text-[10px] text-slate-400 mt-1">Blank = auto ({auto}, from goal points × allocation %).</p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 block mb-1.5">Manual deduction</label>
              <Input type="number" min={0} value={manualDed} onChange={(e) => setManualDed(e.target.value)} className="text-sm" />
              <p className="text-[10px] text-slate-400 mt-1">+ {leaveDays} auto from leave this sprint.</p>
            </div>
          </div>

          {/* Streams */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 block mb-2">Streams</label>
            {activeStreams.length === 0 ? (
              <p className="text-xs text-slate-400">No streams — create them with “Manage Streams”.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {activeStreams.map((s) => {
                  const on = streamIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleStream(s.id)} className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${on ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 border-t border-slate-100 bg-slate-50/50" showCloseButton>
          <Button onClick={handleSave} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isPending ? "Saving…" : "Save Capacity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
