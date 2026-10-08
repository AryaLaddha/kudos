"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cloneSprint, previewClone, type ClonePreview } from "@/app/(app)/sprints/planning-actions";
import { workingDays } from "@/lib/sprintAvailability";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint: { id: string; name: string; start_date: string; end_date: string };
}

const DAY_MS = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Next Monday after the source sprint ends, running two weeks to Friday. */
function suggestedDates(sourceEnd: string) {
  const end = new Date(`${sourceEnd}T00:00:00Z`).getTime();
  let t = end + DAY_MS;
  while (new Date(t).getUTCDay() !== 1) t += DAY_MS;
  return { start: iso(t), end: iso(t + 11 * DAY_MS) };
}

/** "Sprint 16" -> "Sprint 17"; anything else gets " (next)" appended. */
function suggestedName(name: string) {
  const m = name.match(/^(.*?)(\d+)\s*$/);
  return m ? `${m[1]}${Number(m[2]) + 1}` : `${name} (next)`;
}

export default function CloneSprintDialog({ open, onOpenChange, sprint }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const suggestion = useMemo(() => suggestedDates(sprint.end_date), [sprint.end_date]);
  const [name, setName] = useState(suggestedName(sprint.name));
  const [start, setStart] = useState(suggestion.start);
  const [end, setEnd] = useState(suggestion.end);
  const [copyAssignments, setCopyAssignments] = useState(true);
  const [preview, setPreview] = useState<ClonePreview | null>(null);

  useEffect(() => {
    if (!open || !start || !end || end < start) return;
    let cancelled = false;
    previewClone(sprint.id, { start_date: start, end_date: end }).then((res) => {
      if (!cancelled) setPreview(res.preview ?? null);
    });
    return () => { cancelled = true; };
  }, [open, sprint.id, start, end]);

  const dayCount = start && end && end >= start ? workingDays(start, end).length : 0;

  function handleCreate() {
    startTransition(async () => {
      const res = await cloneSprint(sprint.id, { name, start_date: start, end_date: end, copyAssignments });
      if (res.error || !res.sprintId) { toast.error(res.error ?? "Something went wrong."); return; }
      toast.success(`Created ${name}`);
      onOpenChange(false);
      router.push(`/sprints/${res.sprintId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Copy className="h-4 w-4 text-violet-600" /> Create next sprint from {sprint.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <label htmlFor="clone-name" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Sprint name</label>
            <Input id="clone-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="clone-start" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Start</label>
              <Input id="clone-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label htmlFor="clone-end" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">End</label>
              <Input id="clone-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-slate-500">{dayCount} working days. Weekends are skipped, and public holidays reduce each person&apos;s expected points by location.</p>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={copyAssignments} onChange={(e) => setCopyAssignments(e.target.checked)} />
            <span>Keep role assignments for open goals that carry over</span>
          </label>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            {!preview || dayCount === 0 ? (
              <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking what carries over…</span>
            ) : (
              <ul className="space-y-1.5">
                <li><b>{preview.people}</b> people copied with roles, streams, buddies and default deductions. Leave is not copied.</li>
                <li>
                  <b>{preview.carriedGoals.length}</b> open goals carry over
                  {preview.carriedGoals.length > 0 && <>: {preview.carriedGoals.map((g) => g.title).join(", ")}</>}
                  {copyAssignments && <> ({preview.assignments} assignments kept)</>}.
                </li>
                {preview.droppedGoals.length > 0 && (
                  <li className="text-amber-700">
                    <b>{preview.droppedGoals.length}</b> open goals end before the new sprint and won&apos;t carry: {preview.droppedGoals.map((g) => g.title).join(", ")}. Extend their dates if they should.
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={isPending || !name.trim() || dayCount === 0} className="gap-2 bg-violet-600 text-white hover:bg-violet-700">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
