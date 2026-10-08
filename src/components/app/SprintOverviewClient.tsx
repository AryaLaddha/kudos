"use client";

import { useMemo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { GOAL_STATUS_META, GOAL_STATUSES } from "@/lib/sprintGoals";
import { goalsWithoutPeople, streamTotals, workingDays, type PlanningParticipant } from "@/lib/sprintAvailability";
import { findCoverageGaps } from "@/components/app/SprintCoverageClient";
import type { GoalAssignment, PublicHoliday, SprintGoal, Stream } from "@/types";

interface Props {
  sprint: { start_date: string; end_date: string };
  participants: PlanningParticipant[];
  goals: SprintGoal[];
  assignments: GoalAssignment[];
  streams: Stream[];
  holidays: PublicHoliday[];
  onOpenTab: (tab: "goals" | "capacity" | "availability" | "coverage") => void;
}

type Alert = { level: "bad" | "warn"; text: string; tab: "goals" | "capacity" | "availability" | "coverage" };

const r1 = (n: number) => Math.round(n * 10) / 10;

export default function SprintOverviewClient({ sprint, participants, goals, assignments, streams, holidays, onOpenTab }: Props) {
  const days = useMemo(() => workingDays(sprint.start_date, sprint.end_date), [sprint.start_date, sprint.end_date]);
  const streamName = useMemo(() => new Map(streams.map((s) => [s.id, s.name])), [streams]);

  const totals = useMemo(() => streamTotals(participants, assignments), [participants, assignments]);
  const totalCapacity = r1(participants.reduce((s, p) => s + (p.expected_override ?? 0), 0));
  const totalAllocated = r1(assignments.reduce((s, a) => s + (a.allocated_points || 0), 0));
  const maxBar = Math.max(1, ...totals.map((t) => Math.max(t.capacity, t.allocated)));

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>(GOAL_STATUSES.map((s) => [s, 0]));
    for (const g of goals) m.set(g.status, (m.get(g.status) ?? 0) + 1);
    return m;
  }, [goals]);
  const atRisk = goals.filter((g) => g.status === "delayed");

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    const allocatedByUser = new Map<string, number>();
    for (const a of assignments) allocatedByUser.set(a.user_id, (allocatedByUser.get(a.user_id) ?? 0) + (a.allocated_points || 0));
    for (const p of participants) {
      const expected = p.expected_override ?? 0;
      const allocated = r1(allocatedByUser.get(p.user_id) ?? 0);
      if (allocated === 0 && expected > 0) out.push({ level: "warn", text: `${p.profile.full_name} has ${expected} pts of capacity and no goals.`, tab: "capacity" });
      else if (allocated > expected) out.push({ level: "bad", text: `${p.profile.full_name} is over-allocated: ${allocated} pts planned against ${expected} expected.`, tab: "capacity" });
      else if (expected - allocated >= 1) out.push({ level: "warn", text: `${p.profile.full_name} is under-allocated: ${allocated} of ${expected} pts planned.`, tab: "capacity" });
    }
    for (const g of goalsWithoutPeople(goals, assignments)) {
      out.push({ level: "bad", text: `"${g.title}" has no one assigned.`, tab: "goals" });
    }
    for (const gap of findCoverageGaps(participants, holidays, days)) {
      const when = new Date(`${gap.date}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
      out.push({ level: "bad", text: `${gap.name} is away on ${when} with nobody covering.`, tab: "coverage" });
    }
    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "bad" ? -1 : 1));
  }, [participants, goals, assignments, holidays, days]);

  const pct = totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total expected" value={`${totalCapacity}`} sub="points across the team" />
        <Kpi label="Allocated" value={`${totalAllocated}`} sub={`${pct}% of capacity`} />
        <Kpi label="Goals" value={`${goals.length}`} sub={`${statusCounts.get("completed") ?? 0} completed`} />
        <Kpi label="Needs attention" value={`${alerts.length}`} sub={alerts.length === 0 ? "all clear" : "see alerts below"} tone={alerts.length ? "bad" : "ok"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Capacity vs allocation by stream</h3>
          <div className="mb-3 flex flex-wrap gap-x-4 text-[11px] text-slate-500">
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-indigo-100" />Capacity</span>
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-indigo-600" />Allocated</span>
            <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />Over capacity</span>
          </div>
          {totals.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Add people in Capacity Planning to see streams here.</p>
          ) : (
            <div className="space-y-2">
              {totals
                .slice()
                .sort((a, b) => b.capacity - a.capacity)
                .map((t) => {
                  const over = t.allocated > t.capacity;
                  return (
                    <div key={t.streamId ?? "none"} className="grid grid-cols-[6.5rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                      <span className="truncate text-xs font-semibold text-slate-700">{t.streamId ? streamName.get(t.streamId) ?? "Stream" : "No stream"}</span>
                      <div className="relative h-4 rounded bg-slate-100">
                        <div className="absolute inset-y-0 left-0 rounded bg-indigo-100" style={{ width: `${(t.capacity / maxBar) * 100}%` }} />
                        <div className={`absolute inset-y-1 left-0 rounded ${over ? "bg-red-500" : "bg-indigo-600"}`} style={{ width: `${(Math.min(t.allocated, maxBar) / maxBar) * 100}%` }} />
                      </div>
                      <span className="text-right font-mono text-xs tabular-nums text-slate-500">{t.allocated} / {t.capacity}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Goal status</h3>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_STATUSES.map((s) => {
                const m = GOAL_STATUS_META[s];
                return (
                  <div key={s} className="rounded-xl px-3 py-2" style={{ background: m.pillBg, color: m.pillText }}>
                    <div className="text-xl font-extrabold leading-tight">{statusCounts.get(s) ?? 0}</div>
                    <div className="text-[11px] font-semibold">{m.label}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-bold text-slate-900">At-risk goals</h3>
            {atRisk.length === 0 ? (
              <p className="text-sm text-slate-500">No delayed goals.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {atRisk.map((g) => (
                  <li key={g.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{g.title}</span>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Delayed</span>
                    </div>
                    {g.delays?.[0] && <p className="mt-0.5 text-xs italic text-slate-500">&ldquo;{g.delays[0].reason}&rdquo;</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Alerts</h3>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing needs attention.</p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((a, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onOpenTab(a.tab)}
                  className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:brightness-95 ${a.level === "bad" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}
                >
                  {a.level === "bad" ? <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                  <span>{a.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "bad" | "ok" }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold tabular-nums ${tone === "bad" ? "text-red-600" : "text-slate-900"}`}>{value}</p>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}
