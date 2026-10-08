"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  coverageState,
  dayCell,
  holidayIndex,
  toBuddyPerson,
  workingDays,
  type PlanningParticipant,
} from "@/lib/sprintAvailability";
import type { PublicHoliday } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  sprint: { start_date: string; end_date: string };
  participants: PlanningParticipant[];
  holidays: PublicHoliday[];
}

function initials(n: string) {
  return n.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function dayHead(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    dow: d.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" }).slice(0, 1),
    num: d.getUTCDate(),
    long: d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" }),
  };
}

export type CoverageGap = { userId: string; name: string; date: string; reason: "no-buddy" | "buddy-away" };

/** Days someone is away with nobody covering. Shared with the Overview alerts. */
export function findCoverageGaps(
  participants: PlanningParticipant[],
  holidays: PublicHoliday[],
  days: string[],
): CoverageGap[] {
  const idx = holidayIndex(holidays);
  const people = participants.map(toBuddyPerson);
  const byUser = new Map(people.map((p) => [p.user_id, p]));
  const names = new Map(participants.map((p) => [p.user_id, p.profile.full_name]));
  const gaps: CoverageGap[] = [];
  for (const p of people) {
    for (const d of days) {
      if (coverageState(p, d, byUser, idx).state !== "uncovered") continue;
      gaps.push({
        userId: p.user_id,
        name: names.get(p.user_id) ?? "Someone",
        date: d,
        reason: p.buddy_user_ids.length === 0 ? "no-buddy" : "buddy-away",
      });
    }
  }
  return gaps;
}

export default function SprintCoverageClient({ sprint, participants, holidays }: Props) {
  const days = useMemo(() => workingDays(sprint.start_date, sprint.end_date), [sprint.start_date, sprint.end_date]);
  const idx = useMemo(() => holidayIndex(holidays), [holidays]);
  const people = useMemo(() => participants.map(toBuddyPerson), [participants]);
  const byUser = useMemo(() => new Map(people.map((p) => [p.user_id, p])), [people]);
  const nameById = useMemo(() => new Map(participants.map((p) => [p.user_id, p.profile.full_name])), [participants]);
  const gaps = useMemo(() => findCoverageGaps(participants, holidays, days), [participants, holidays, days]);

  // Only people with at least one absence need a row; the rest would be a wall of identical cells.
  const withAbsence = participants.filter((p) => {
    const bp = byUser.get(p.user_id)!;
    return days.some((d) => dayCell(d, bp.location, bp.availability, idx).value === 0);
  });

  return (
    <div className="space-y-4">
      {gaps.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Every absence this sprint has a buddy covering.
        </div>
      ) : (
        <div className="space-y-2">
          {gaps.map((g) => (
            <div key={`${g.userId}-${g.date}`} className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                <b>{g.name}</b> is away on {dayHead(g.date).long}
                {g.reason === "no-buddy" ? " and has no buddy set." : " and every buddy is away too."}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-indigo-100" />Working</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-100" />Away</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-violet-100" />Holiday</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-200" />Buddy covering (initials)</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />Nobody covering</span>
        </div>

        {withAbsence.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No one has leave or holidays in this sprint.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Person → buddy</th>
                  {days.map((d) => {
                    const h = dayHead(d);
                    return (
                      <th key={d} className="px-0.5 py-1.5 text-center text-[10px] font-medium leading-tight text-slate-400">
                        {h.dow}<br />{h.num}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {withAbsence.map((p) => {
                  const bp = byUser.get(p.user_id)!;
                  return (
                    <tr key={p.user_id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-2 py-1.5">
                        <div className="font-semibold text-slate-900">{p.profile.full_name}</div>
                        <div className="text-[10px] text-slate-400">
                          → {bp.buddy_user_ids.length ? bp.buddy_user_ids.map((b) => nameById.get(b) ?? "?").join(", ") : "no buddy"}
                        </div>
                      </td>
                      {days.map((d) => {
                        const cov = coverageState(bp, d, byUser, idx);
                        const cell = dayCell(d, bp.location, bp.availability, idx);
                        let cls = "bg-indigo-100 text-indigo-700";
                        let text = cell.kind === "half" ? "½" : "";
                        let title = "Working";
                        if (cov.state === "holiday") { cls = "bg-violet-100 text-violet-700"; text = "H"; title = cell.kind === "holiday" ? cell.name : "Holiday"; }
                        else if (cov.state === "covered") {
                          cls = "bg-emerald-200 text-emerald-900 font-bold";
                          const who = cov.coveredBy ? nameById.get(cov.coveredBy) ?? "" : "";
                          text = initials(who); title = `Covered by ${who}`;
                        } else if (cov.state === "uncovered") { cls = "bg-red-500 text-white font-bold"; text = "!"; title = "Away, nobody covering"; }
                        return (
                          <td key={d} className="px-0.5 py-1 text-center">
                            <span title={title} className={cn("inline-flex h-7 w-8 items-center justify-center rounded-md text-[10px]", cls)}>{text}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
