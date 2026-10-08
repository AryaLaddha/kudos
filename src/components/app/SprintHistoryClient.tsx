"use client";

import { useMemo } from "react";
import { GOAL_STATUS_META, goalJourney, overlapsSprint, type JourneyDot } from "@/lib/sprintGoals";
import type { SprintStat } from "@/app/(app)/sprints/planning-actions";
import type { SprintGoal, SprintRef, Stream } from "@/types";

interface Props {
  sprint: { id: string; start_date: string };
  goals: SprintGoal[]; // every org goal
  sprints: SprintRef[];
  stats: SprintStat[];
  streams: Stream[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const LAST = 6;

const DOT_PILL: Record<JourneyDot["status"], { cls: string; label: string }> = {
  on_track: { cls: "p-ok", label: "On track" },
  delayed: { cls: "p-bad", label: "Delayed" },
  completed: { cls: "p-done", label: "Done" },
  carried: { cls: "p-hold", label: "Carried" },
  scheduled: { cls: "p-warn", label: "Scheduled" },
};

export default function SprintHistoryClient({ sprint, goals, sprints, stats, streams }: Props) {
  const ordered = useMemo(() => [...sprints].sort((a, b) => a.start_date.localeCompare(b.start_date)), [sprints]);
  const current = ordered.find((s) => s.id === sprint.id);
  // Up to the last six sprints, ending at the one being viewed.
  const window = useMemo(() => {
    const idx = ordered.findIndex((s) => s.id === sprint.id);
    const upto = idx === -1 ? ordered : ordered.slice(0, idx + 1);
    return upto.slice(-LAST);
  }, [ordered, sprint.id]);
  const statById = useMemo(() => new Map(stats.map((s) => [s.id, s])), [stats]);
  const streamName = useMemo(() => new Map(streams.map((s) => [s.id, s.name])), [streams]);
  const todayKey = new Date().toISOString().slice(0, 10);

  // Share of a sprint's goals that were already running in the sprint before it.
  const carryRate = (s: SprintRef) => {
    const i = ordered.findIndex((x) => x.id === s.id);
    const inSprint = goals.filter((g) => overlapsSprint(g, s));
    if (i <= 0 || inSprint.length === 0) return null;
    const prev = ordered[i - 1];
    const carried = inSprint.filter((g) => overlapsSprint(g, prev) && g.status !== "completed").length;
    return Math.round((carried / inSprint.length) * 100);
  };
  const completion = (s: SprintRef) => {
    const inSprint = goals.filter((g) => overlapsSprint(g, s));
    const done = inSprint.filter((g) => g.status === "completed" && g.completed_at && g.completed_at.slice(0, 10) <= s.end_date).length;
    return { done, total: inSprint.length };
  };

  const capSeries = window.map((s) => statById.get(s.id)?.capacity ?? 0);
  const allocSeries = window.map((s) => statById.get(s.id)?.allocated ?? 0);
  const carrySeries = window.map((s) => carryRate(s) ?? 0);
  const labels = window.map((s) => s.name.replace(/^sprint\s*/i, "S"));
  const avgCap = capSeries.length ? r1(capSeries.reduce((a, b) => a + b, 0) / capSeries.length) : 0;
  const cur = current ? statById.get(current.id) : undefined;
  const curCarry = current ? carryRate(current) : null;
  const prevSprint = (() => { const i = ordered.findIndex((s) => s.id === sprint.id); return i > 0 ? ordered[i - 1] : null; })();
  const prevDone = prevSprint ? completion(prevSprint) : null;

  // Goals that touch the shown sprints, newest first.
  const tracked = goals
    .filter((g) => window.some((s) => overlapsSprint(g, s)))
    .sort((a, b) => (b.end_date ?? "").localeCompare(a.end_date ?? ""))
    .slice(0, 30);

  return (
    <div className="sp-screen">
      <div className="sp-grid sp-g-kpi">
        <div className="sp-panel sp-kpi">
          <span className="l">Carry-over rate</span>
          <span className="v">{curCarry === null ? "—" : `${curCarry}%`}</span>
          <span className="note">of this sprint&apos;s goals started earlier</span>
        </div>
        <div className="sp-panel sp-kpi">
          <span className="l">{prevSprint ? `Goals completed (${prevSprint.name})` : "Goals completed"}</span>
          <span className="v">{prevDone ? `${prevDone.done} / ${prevDone.total}` : "—"}</span>
          <span className="note">{prevDone && prevDone.total ? `${Math.round((prevDone.done / prevDone.total) * 100)}% completion` : "no earlier sprint"}</span>
        </div>
        <div className="sp-panel sp-kpi">
          <span className="l">Average capacity</span>
          <span className="v">{avgCap}</span>
          <span className="note">points per sprint, last {window.length}</span>
        </div>
        <div className="sp-panel sp-kpi">
          <span className="l">Planned vs capacity</span>
          <span className="v">{cur && cur.capacity > 0 ? `${Math.round((cur.allocated / cur.capacity) * 100)}%` : "—"}</span>
          <span className="note">this sprint so far</span>
        </div>
      </div>

      <div className="sp-grid sp-g-2">
        <div className="sp-panel">
          <h2>Capacity vs planned <span className="note">last {window.length} sprints</span></h2>
          <LineChart
            labels={labels}
            series={[
              { label: "Capacity", color: "var(--sp-accent)", data: capSeries, area: true },
              { label: "Planned", color: "var(--sp-warn)", data: allocSeries, dash: "5 4" },
            ]}
            unit=""
          />
        </div>
        <div className="sp-panel">
          <h2>Carry-over rate</h2>
          <LineChart labels={labels} series={[{ label: "Goals carried over", color: "var(--sp-hold)", data: carrySeries, area: true }]} unit="%" fixedMax={100} />
        </div>
      </div>

      <div className="sp-panel">
        <h2>Goal progress across sprints <span className="note">each goal, sprint by sprint</span></h2>
        {tracked.length === 0 ? (
          <div className="sp-empty">No goals overlap these sprints yet.</div>
        ) : (
          <div className="sp-tw">
            <table>
              <thead>
                <tr>
                  <th>Goal</th>
                  {window.map((s) => <th key={s.id}>{s.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {tracked.map((g) => {
                  const journey = new Map(goalJourney(g, window, todayKey).map((d) => [d.sprint.id, d.status]));
                  return (
                    <tr key={g.id}>
                      <td>
                        <b>{g.title}</b>
                        <br />
                        <span className="note">{g.stream_ids.map((id) => streamName.get(id)).filter(Boolean).join(", ") || "No stream"}</span>
                      </td>
                      {window.map((s) => {
                        const st = journey.get(s.id);
                        return <td key={s.id}>{st ? <span className={`sp-pill ${DOT_PILL[st].cls}`}>{DOT_PILL[st].label}</span> : <span className="note">—</span>}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="note" style={{ marginTop: 10 }}>
          Current status of each goal: {Object.values(GOAL_STATUS_META).map((m) => m.label).join(", ")}.
        </p>
      </div>
    </div>
  );
}

type Series = { label: string; color: string; data: number[]; area?: boolean; dash?: string };

function LineChart({ labels, series, unit, fixedMax }: { labels: string[]; series: Series[]; unit: string; fixedMax?: number }) {
  const W = 520, H = 210, L = 38, R = 16, T = 14, B = 28;
  const pw = W - L - R, ph = H - T - B, n = labels.length;
  if (n === 0) return <div className="sp-empty">No sprints to chart yet.</div>;
  const rawMax = Math.max(1, ...series.flatMap((s) => s.data));
  const max = fixedMax ?? Math.ceil((rawMax * 1.15) / 10) * 10;
  const x = (i: number) => (n === 1 ? L + pw / 2 : L + (pw * i) / (n - 1));
  const y = (v: number) => T + ph - (ph * v) / max;
  return (
    <div className="sp-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 420 }} role="img" aria-label={series.map((s) => s.label).join(" and ")}>
        {[0, 1, 2, 3, 4].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={T + ph - (ph * g) / 4} y2={T + ph - (ph * g) / 4} stroke="var(--sp-line)" />
            <text x={L - 6} y={T + ph - (ph * g) / 4 + 4} textAnchor="end">{Math.round((max * g) / 4)}{unit}</text>
          </g>
        ))}
        {labels.map((l, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle">{l}</text>)}
        {series.map((s) => {
          const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          const last = s.data[n - 1];
          return (
            <g key={s.label}>
              {s.area && n > 1 && <path d={`M${pts.replace(/ /g, "L")}L${x(n - 1)},${T + ph}L${x(0)},${T + ph}Z`} fill={s.color} opacity="0.12" />}
              <polyline fill="none" stroke={s.color} strokeWidth="2.2" strokeDasharray={s.dash} points={pts} />
              <circle cx={x(n - 1)} cy={y(last)} r="4" fill={s.color} />
              <text x={x(n - 1) - 6} y={y(last) - 9} textAnchor="end" style={{ fill: s.color, fontWeight: 600 }}>{last}{unit}</text>
            </g>
          );
        })}
      </svg>
      <div className="sp-key" style={{ marginTop: 6 }}>
        {series.map((s) => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}
      </div>
    </div>
  );
}
