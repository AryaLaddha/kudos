"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GOAL_STATUS_META, GOAL_STATUSES, colorForId, goalJourney, overlapsSprint, type JourneyDot } from "@/lib/sprintGoals";
import { formatDateRange, formatShortDate, toDateKey } from "@/lib/leave";
import type { SprintGoal, SprintRef, Stream } from "@/types";
import { Download, History } from "lucide-react";

interface OrgUser { id: string; full_name: string; }
interface Props {
  goals: SprintGoal[];
  sprints: SprintRef[];
  streams: Stream[];
  orgUsers: OrgUser[];
}

const JOURNEY_STYLE: Record<JourneyDot["status"], { icon: string; bg: string; text: string }> = {
  on_track:  { icon: "✓", bg: "#DCFCE7", text: "#166534" },
  delayed:   { icon: "⚠", bg: "#FEE2E2", text: "#991B1B" },
  completed: { icon: "✓", bg: "#DBEAFE", text: "#1E40AF" },
  carried:   { icon: "→", bg: "#EDE9FE", text: "#5B21B6" },
  scheduled: { icon: "📅", bg: "#F1F5F9", text: "#475569" },
};

export default function GoalHistoryClient({ goals, sprints, streams, orgUsers }: Props) {
  const [sprintFilter, setSprintFilter] = useState("all");
  const [streamFilter, setStreamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const today = new Date();
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const streamName = useMemo(() => {
    const m = new Map(streams.map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? "Stream";
  }, [streams]);
  const userName = useMemo(() => {
    const m = new Map(orgUsers.map((u) => [u.id, u.full_name]));
    return (id: string | null) => (id ? m.get(id) ?? "Someone" : "Someone");
  }, [orgUsers]);
  const sprintById = useMemo(() => new Map(sprints.map((s) => [s.id, s])), [sprints]);

  const filtered = useMemo(() => {
    return goals.filter((g) => {
      if (streamFilter !== "all" && !g.stream_ids.includes(streamFilter)) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (sprintFilter !== "all") {
        const s = sprintById.get(sprintFilter);
        if (!s || !overlapsSprint(g, s)) return false;
      }
      return true;
    });
  }, [goals, streamFilter, statusFilter, sprintFilter, sprintById]);

  function exportCsv() {
    const header = ["Goal", "Start", "End", "Points", "Streams", "Status", "Delays", "Latest delay reason"];
    const rows = filtered.map((g) => {
      const delays = g.delays ?? [];
      return [
        g.title,
        g.start_date,
        g.end_date,
        String(g.points),
        g.stream_ids.map(streamName).join("; "),
        GOAL_STATUS_META[g.status].label,
        String(delays.length),
        delays[0]?.reason ?? "",
      ];
    });
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "goal-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 outline-none">
          <option value="all">All Sprints</option>
          {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={streamFilter} onChange={(e) => setStreamFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 outline-none">
          <option value="all">All Streams</option>
          {streams.filter((s) => !s.is_archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 outline-none">
          <option value="all">All Statuses</option>
          {GOAL_STATUSES.map((s) => <option key={s} value={s}>{GOAL_STATUS_META[s].label}</option>)}
        </select>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0} className="h-8 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <History className="mx-auto h-8 w-8 text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-400">{goals.length === 0 ? "No goals yet." : "No goals match your filters."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="px-4 py-2.5 text-xs font-bold text-slate-600">Goal</th>
                <th className="px-3 py-2.5 text-xs font-bold text-slate-600">Streams</th>
                <th className="px-3 py-2.5 text-xs font-bold text-slate-600 text-center">Pts</th>
                <th className="px-3 py-2.5 text-xs font-bold text-slate-600">Sprint Journey</th>
                <th className="px-3 py-2.5 text-xs font-bold text-slate-600">Delay Log</th>
                <th className="px-3 py-2.5 text-xs font-bold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const status = GOAL_STATUS_META[g.status];
                const journey = goalJourney(g, sprints, todayKey);
                const delays = g.delays ?? [];
                return (
                  <tr key={g.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{g.title}</div>
                      <div className="text-[11px] text-slate-400">{formatDateRange(g.start_date, g.end_date)}{g.end_date > g.original_end_date && " (extended)"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {g.stream_ids.map((sid) => (
                          <span key={sid} className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: `${colorForId(sid)}1A`, color: colorForId(sid) }}>{streamName(sid)}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-extrabold text-indigo-600">{g.points}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {journey.length === 0 ? <span className="text-[11px] text-slate-300 italic">—</span> : journey.map((d, i) => {
                          const st = JOURNEY_STYLE[d.status];
                          return (
                            <span key={d.sprint.id} className="flex items-center gap-1">
                              {i > 0 && <span className="text-slate-300 text-[10px]">→</span>}
                              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap" style={{ background: st.bg, color: st.text }} title={`${d.sprint.name}: ${d.status}`}>
                                {d.sprint.name} {st.icon}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {delays.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">No delays</span>
                      ) : (
                        <div className="space-y-1.5">
                          {delays.map((d) => (
                            <div key={d.id} className="text-[11px] text-slate-600">
                              <span className="font-semibold">{formatShortDate(d.created_at.slice(0, 10))}</span>
                              {d.sprint_id && sprintById.get(d.sprint_id) && <span className="text-slate-400"> · {sprintById.get(d.sprint_id)!.name}</span>}
                              <div className="text-slate-500 italic">&ldquo;{d.reason}&rdquo;</div>
                              <div className="text-slate-400">{userName(d.reported_by)}{d.new_due_date && ` · new due ${formatShortDate(d.new_due_date)}`}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap" style={{ background: status.pillBg, color: status.pillText }}>{status.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
