"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createStream, setStreamArchived } from "@/app/(app)/sprints/goals-actions";
import { colorForId } from "@/lib/sprintGoals";
import type { Stream } from "@/types";
import { toast } from "sonner";
import { Plus, Archive, ArchiveRestore, Layers } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streams: Stream[];
  setStreams: React.Dispatch<React.SetStateAction<Stream[]>>;
}

export default function StreamManagerDialog({ open, onOpenChange, streams, setStreams }: Props) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createStream(trimmed);
      if (res.error || !res.stream) { toast.error(res.error ?? "Something went wrong."); return; }
      setStreams((prev) => [...prev, res.stream!].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      toast.success("Stream created.");
    });
  }

  function handleArchive(s: Stream, archived: boolean) {
    setStreams((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_archived: archived } : x)));
    startTransition(async () => {
      const res = await setStreamArchived(s.id, archived);
      if (res.error) {
        toast.error(res.error);
        setStreams((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_archived: !archived } : x)));
      }
    });
  }

  const active = streams.filter((s) => !s.is_archived);
  const archived = streams.filter((s) => s.is_archived);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-0 gap-0 max-h-[85vh] flex flex-col" showCloseButton>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Layers className="h-4 w-4 text-indigo-600" /> Manage Streams
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">Streams tag goals and people by area of work.</p>
        </DialogHeader>

        <div className="px-5 py-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }} placeholder="New stream name…" maxLength={40} className="text-sm h-8 flex-1" />
            <Button size="sm" onClick={handleCreate} disabled={isPending || !name.trim()} className="h-8 gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>

          {active.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {active.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorForId(s.id) }} />
                  <span className="flex-1 text-sm text-slate-700">{s.name}</span>
                  <button onClick={() => handleArchive(s, true)} className="text-slate-300 hover:text-slate-600 flex items-center gap-1 text-xs" title="Archive">
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {archived.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Archived</p>
              <div className="space-y-1.5">
                {archived.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <span className="flex-1 text-sm text-slate-400 line-through">{s.name}</span>
                    <button onClick={() => handleArchive(s, false)} className="text-slate-400 hover:text-indigo-600 flex items-center gap-1 text-xs" title="Restore">
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {streams.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No streams yet. Add your first above.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
