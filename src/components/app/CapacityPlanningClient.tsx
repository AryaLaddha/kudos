"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CapacityEditDialog, { type CapacityPatch } from "@/components/app/CapacityEditDialog";
import StreamManagerDialog from "@/components/app/StreamManagerDialog";
import { autoExpectedPoints, colorForId, effectiveExpected, totalAllocation } from "@/lib/sprintGoals";
import type { LeaveDeduction, SprintGoal, Stream } from "@/types";
import { Layers, Pencil, Users, AlertTriangle, Plane } from "lucide-react";

interface CapacityMember {
  user_id: string;
  goal_allocations: Record<string, number>;
  expected_override: number | null;
  manual_deducted_points: number;
  stream_ids: string[];
  profile: { id: string; full_name: string; avatar_url: string | null; job_title?: string | null };
}

interface Props {
  sprint: { id: string };
  participants: CapacityMember[];
  goals: SprintGoal[];
  streams: Stream[];
  setStreams: React.Dispatch<React.SetStateAction<Stream[]>>;
  leaveDeductions: Record<string, LeaveDeduction>;
  onPatchParticipant: (userId: string, patch: CapacityPatch) => void;
}

function initials(n: string) {
  return n.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export default function CapacityPlanningClient({ sprint, participants, goals, streams, setStreams, leaveDeductions, onPatchParticipant }: Props) {
  const [editing, setEditing] = useState<CapacityMember | null>(null);
  const [streamsOpen, setStreamsOpen] = useState(false);

  const goalsById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const streamName = useMemo(() => {
    const m = new Map(streams.map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? "Stream";
  }, [streams]);

  // Per-member derived capacity numbers.
  const rows = useMemo(() => {
    return participants.map((p) => {
      // Only count allocations to goals still active in this sprint window.
      const allocations: Record<string, number> = {};
      for (const [gid, pct] of Object.entries(p.goal_allocations ?? {})) {
        if (goalsById.has(gid)) allocations[gid] = pct;
      }
      const allocTotal = totalAllocation(allocations);
      const auto = autoExpectedPoints(allocations, goalsById);
      const expected = effectiveExpected(p.expected_override ?? null, allocations, goalsById);
      const leaveDays = leaveDeductions[p.user_id]?.days ?? 0;
      const deducted = (p.manual_deducted_points ?? 0) + leaveDays;
      return {
        member: p,
        allocations,
        allocTotal,
        auto,
        expected,
        leaveDays,
        leaveNotices: leaveDeductions[p.user_id]?.notices ?? [],
        deducted,
        net: expected - deducted,
        over: allocTotal > 100,
      };
    });
  }, [participants, goalsById, leaveDeductions]);

  const stats = useMemo(() => {
    const members = rows.length;
    const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
    const totalDeducted = rows.reduce((s, r) => s + r.deducted, 0);
    const avgAlloc = members ? Math.round(rows.reduce((s, r) => s + r.allocTotal, 0) / members) : 0;
    return {
      members,
      totalExpected: Math.round(totalExpected * 10) / 10,
      totalDeducted,
      net: Math.round((totalExpected - totalDeducted) * 10) / 10,
      avgAlloc,
    };
  }, [rows]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" /> Capacity
        </h2>
        <Button size="sm" variant="outline" onClick={() => setStreamsOpen(true)} className="h-8 gap-1.5 text-xs">
          <Layers className="h-3.5 w-3.5" /> Manage Streams
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Stat label="Team Members" value={stats.members} color="text-indigo-600" />
        <Stat label="Total Exp. Points" value={stats.totalExpected} color="text-emerald-600" />
        <Stat label="Total Ded. Points" value={stats.totalDeducted} color="text-red-600" />
        <Stat label="Net Capacity" value={stats.net} color="text-slate-800" />
        <Stat label="Avg Allocation" value={`${stats.avgAlloc}%`} color="text-sky-600" />
      </div>

      {/* Member cards */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-400">No participants yet — add people from the Grid Tracker tab.</p>
        </div>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {rows.map((r) => (
            <div key={r.member.user_id} className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${r.over ? "border-red-200" : "border-slate-200"}`}>
              {/* Top */}
              <div className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 ${r.over ? "bg-red-50/60" : ""}`}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={r.member.profile.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">{initials(r.member.profile.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{r.member.profile.full_name}</p>
                  {r.member.profile.job_title && <p className="text-[11px] text-slate-400 truncate">{r.member.profile.job_title}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{r.expected} exp</span>
                  <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${r.deducted > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-400"}`}>{r.deducted} ded</span>
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-3">
                {/* Streams */}
                {(r.member.stream_ids ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(r.member.stream_ids ?? []).map((sid) => (
                      <span key={sid} className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${colorForId(sid)}1A`, color: colorForId(sid) }}>{streamName(sid)}</span>
                    ))}
                  </div>
                )}

                {/* Allocation bar */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Allocation</span>
                  <span className={`text-xs font-extrabold ${r.over ? "text-red-600" : "text-indigo-600"}`}>{r.allocTotal}%{r.over && " ⚠"}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-2.5">
                  <div className={`h-full rounded-full ${r.over ? "bg-gradient-to-r from-red-500 to-red-400" : "bg-gradient-to-r from-indigo-500 to-indigo-400"}`} style={{ width: `${Math.min(r.allocTotal, 100)}%` }} />
                </div>

                {/* Allocation breakdown */}
                <div className="space-y-1">
                  {Object.entries(r.allocations).map(([gid, pct]) => (
                    <div key={gid} className="flex items-center gap-2 text-[11px]">
                      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: colorForId(gid) }} />
                      <span className="flex-1 min-w-0 truncate text-slate-600">{goalsById.get(gid)?.title ?? "Goal"}</span>
                      <span className="text-slate-400 font-bold">{pct}%</span>
                    </div>
                  ))}
                  {Object.keys(r.allocations).length === 0 && <p className="text-[11px] text-slate-400 italic">No allocation set.</p>}
                </div>

                {/* Leave notices */}
                {r.leaveNotices.map((notice, i) => (
                  <div key={i} className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-100 px-2 py-1 text-[10px] text-amber-800">
                    <Plane className="h-3 w-3 flex-shrink-0" /> {notice}
                  </div>
                ))}

                {/* Over-alloc warning */}
                {r.over && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-md bg-red-50 border border-red-100 px-2 py-1 text-[10px] text-red-700">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" /> Overallocated by {r.allocTotal - 100}% — please reduce.
                  </div>
                )}

                {/* Edit */}
                <button onClick={() => setEditing(r.member)} className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                  <Pencil className="h-3.5 w-3.5" /> Edit capacity
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      {editing && (
        <CapacityEditDialog
          key={editing.user_id}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          sprint={sprint}
          participant={editing}
          goals={goals}
          streams={streams}
          leaveDays={leaveDeductions[editing.user_id]?.days ?? 0}
          onSaved={(patch) => { onPatchParticipant(editing.user_id, patch); setEditing(null); }}
        />
      )}
      <StreamManagerDialog open={streamsOpen} onOpenChange={setStreamsOpen} streams={streams} setStreams={setStreams} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
      <div className={`text-2xl font-extrabold leading-none ${color}`}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-1">{label}</div>
    </div>
  );
}
