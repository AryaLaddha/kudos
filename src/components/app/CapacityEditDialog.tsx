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
import { updateParticipantCapacity } from "@/app/(app)/sprints/goals-actions";
import { ROLE_OPTIONS } from "@/lib/sprintGoals";
import type { Stream } from "@/types";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";

export interface CapParticipant {
  user_id: string;
  role: string | null;
  expected_override: number | null;
  stream_ids: string[];
  profile: { full_name: string };
}

export interface CapacityPatch {
  role: string | null;
  expected_override: number | null;
  stream_ids: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint: { id: string };
  participant: CapParticipant;
  streams: Stream[];
  /** Points currently allocated to this member via role assignments (for reference). */
  allocatedPoints: number;
  onSaved: (patch: CapacityPatch) => void;
}

export default function CapacityEditDialog({ open, onOpenChange, sprint, participant, streams, allocatedPoints, onSaved }: Props) {
  const [role, setRole] = useState(participant.role ?? "");
  const [overrideInput, setOverrideInput] = useState(
    participant.expected_override !== null && participant.expected_override !== undefined ? String(participant.expected_override) : "",
  );
  const [streamIds, setStreamIds] = useState<string[]>(participant.stream_ids ?? []);
  const [isPending, startTransition] = useTransition();

  function toggleStream(id: string) {
    setStreamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSave() {
    const override = overrideInput.trim() === "" ? null : Math.max(0, Math.round(Number(overrideInput)));
    if (override !== null && !Number.isFinite(override)) return toast.error("Expected points must be a number.");
    const patch: CapacityPatch = {
      role: role || null,
      expected_override: override,
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
      <DialogContent className="max-w-md w-full p-0 gap-0 max-h-[88vh] flex flex-col" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <SlidersHorizontal className="h-4 w-4 text-indigo-600" /> {participant.profile.full_name}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">Set role, expected points, deductions and streams.</p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-5 overflow-y-auto">
          {/* Role */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 block mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="">No role</option>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Expected points (manual capacity) */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 block mb-1.5">Expected points</label>
            <Input type="number" min={0} value={overrideInput} onChange={(e) => setOverrideInput(e.target.value)} placeholder="e.g. 8" className="text-sm w-32" />
            <p className="text-[10px] text-slate-400 mt-1">Their capacity for this sprint. Currently allocated {allocatedPoints} pts across assigned goals — over/under is judged against this number.</p>
          </div>

          {/* Streams */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 block mb-2">Streams</label>
            {activeStreams.length === 0 ? (
              <p className="text-xs text-slate-400">No streams — create them in the Streams tab.</p>
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
