"use client";

import { useMemo } from "react";
import { GOAL_STATUS_META, GOAL_STATUSES } from "@/lib/sprintGoals";
import { goalsWithoutPeople, streamTotals, workingDays, type PlanningParticipant } from "@/lib/sprintAvailability";
import { findCoverageGaps } from "@/components/app/SprintCoverageClient";
import type { GoalAssignment, PublicHoliday, SprintGoal, Stream } from "@/types";

export type PlannerTab = "overview" | "capacity" | "goals" | "coverage" | "history" | "setup" | "grid";

interface Props {
  sprint: { start_date: string; end_date: string };
  participants: PlanningParticipant[];
  goals: SprintGoal[];
  assignments: GoalAssignment[];
  streams: Stream[];
  holidays: PublicHoliday[];
  onOpenTab: (tab: PlannerTab) => void;
}

type Alert = { level: "bad" | "warn"; text: string; tab: PlannerTab };

const r1 = (n: number) => Math.round(n * 10) / 10;

const STATUS_PILL: Record<string, string> = {
  on_track: "p-ok",
  delayed: "p-bad",
  completed: "p-done",
  carried_over: "p-hold",
};

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
  const needs = alerts.length;

  return (
    <div className="sp-screen">
      <div className="sp-grid sp-g-kpi">
        <Kpi label="Total expected points" value={`${totalCapacity}`} note="sum of everyone's net capacity" />
        <Kpi label="Allocated" value={`${totalAllocated}`} note={`${pct}% of capacity`} />
        <Kpi label="Goals this sprint" value={`${goals.length}`} note={`${statusCounts.get("completed") ?? 0} completed`} />
        <Kpi label="Needs attention" value={`${needs}`} note={needs === 0 ? "all clear" : "see alerts below"} color={needs ? "var(--sp-bad)" : undefined} />
      </div>

      <div className="sp-grid sp-g-2">
        <div className="sp-panel">
          <h2>Capacity vs allocation by stream <span className="note">points</span></h2>
          <div className="sp-key">
            <span><i style={{ background: "var(--sp-cell-full)" }} />Capacity</span>
            <span><i style={{ background: "var(--sp-accent)" }} />Planned</span>
            <span><i style={{ background: "var(--sp-bad)" }} />Over capacity</span>
          </div>
          {totals.length === 0 ? (
            <div className="sp-empty">Add people in Capacity &amp; allocation to see streams here.</div>
          ) : (
            totals
              .slice()
              .sort((a, b) => b.capacity - a.capacity)
              .map((t) => (
                <div key={t.streamId ?? "none"} className={`sp-sbar${t.allocated > t.capacity ? " over" : ""}`}>
                  <span className="nm">{t.streamId ? streamName.get(t.streamId) ?? "Stream" : "No stream"}</span>
                  <div className="sp-track">
                    <div className="sp-cap" style={{ width: `${(t.capacity / maxBar) * 100}%` }} />
                    <div className="sp-alloc" style={{ width: `${(Math.min(t.allocated, maxBar) / maxBar) * 100}%` }} />
                  </div>
                  <span className="nums mono">{t.allocated} / {t.capacity}</span>
                </div>
              ))
          )}
        </div>

        <div className="sp-col">
          <div className="sp-panel">
            <h2>Goal status</h2>
            <div className="sp-counts">
              {GOAL_STATUSES.map((s) => (
                <div key={s}>
                  <div className="n" style={{ color: `var(--sp-${s === "on_track" ? "ok" : s === "delayed" ? "bad" : s === "completed" ? "accent" : "hold"})` }}>
                    {statusCounts.get(s) ?? 0}
                  </div>
                  <span className="note">{GOAL_STATUS_META[s].label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="sp-panel">
            <h2>At-risk goals</h2>
            {atRisk.length === 0 ? (
              <span className="note">No delayed goals.</span>
            ) : (
              atRisk.map((g) => (
                <div key={g.id} className="sp-risk">
                  <div className="r1">
                    <b style={{ fontSize: 13.5 }}>{g.title}</b>
                    <span className={`sp-pill ${STATUS_PILL[g.status]}`}>{GOAL_STATUS_META[g.status].label}</span>
                  </div>
                  {g.delays?.[0] && <span className="note">&ldquo;{g.delays[0].reason}&rdquo;</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="sp-panel">
        <h2>Alerts <span className="note">from the planning rules</span></h2>
        <div className="sp-alerts">
          {alerts.length === 0 ? (
            <div className="sp-alert ok"><span className="ic">✓</span><span>Nothing needs attention.</span></div>
          ) : (
            alerts.map((a, i) => (
              <button key={i} type="button" onClick={() => onOpenTab(a.tab)} className={`sp-alert${a.level === "bad" ? " bad" : ""}`}>
                <span className="ic">{a.level === "bad" ? "!!" : "!"}</span>
                <span>{a.text}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, note, color }: { label: string; value: string; note: string; color?: string }) {
  return (
    <div className="sp-panel sp-kpi">
      <span className="l">{label}</span>
      <span className="v" style={color ? { color } : undefined}>{value}</span>
      <span className="note">{note}</span>
    </div>
  );
}
