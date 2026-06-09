"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createStream, setStreamArchived } from "@/app/(app)/sprints/goals-actions";
import { colorForId } from "@/lib/sprintGoals";
import type { Stream } from "@/types";
import { toast } from "sonner";
import { Plus, Archive, ArchiveRestore, Layers } from "lucide-react";

interface Props {
  streams: Stream[];
  setStreams: React.Dispatch<React.SetStateAction<Stream[]>>;
}

export default function StreamsManagementClient({ streams, setStreams }: Props) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (streams.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("A stream with that name already exists.");
      return;
    }
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
        return;
      }
      toast.success(archived ? "Stream archived." : "Stream restored.");
    });
  }

  const active = streams.filter((s) => !s.is_archived);
  const archived = streams.filter((s) => s.is_archived);

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        <Layers className="h-4 w-4 text-slate-400" />
        <p className="text-sm text-slate-500">Work streams are shared org-wide and used to tag goals and people across every sprint.</p>
      </div>

      {/* Create */}
      <div className="flex items-center gap-2 mb-6">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          placeholder="New stream name…"
          maxLength={40}
          className="text-sm h-9 flex-1"
        />
        <Button onClick={handleCreate} disabled={isPending || !name.trim()} className="h-9 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="h-4 w-4" /> Add Stream
        </Button>
      </div>

      {/* Active */}
      <section className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3">Active ({active.length})</h2>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm font-medium text-slate-400">No active streams. Add one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: colorForId(s.id) }} />
                <span className="flex-1 text-sm font-medium text-slate-800">{s.name}</span>
                <button
                  onClick={() => handleArchive(s, true)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Archived */}
      {archived.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">Archived ({archived.length})</h2>
          <div className="space-y-2">
            {archived.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="flex-1 text-sm font-medium text-slate-400 line-through">{s.name}</span>
                <button
                  onClick={() => handleArchive(s, false)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
