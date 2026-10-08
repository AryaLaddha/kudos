"use client";

import { useMemo } from "react";
import {
  coverageState,
  dayCell,
  holidayIndex,
  toBuddyPerson,
  workingDays,
  type PlanningParticipant,
} from "@/lib/sprintAvailability";
import type { PublicHoliday } from "@/types";

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
    <div className="sp-screen">
      <div className="sp-panel">
        <h2>Who covers whom <span className="note">{days.length} working days</span></h2>
        <div className="sp-key">
          <span><i style={{ background: "var(--sp-cell-full)" }} />Working</span>
          <span><i style={{ background: "var(--sp-cell-hol)" }} />Holiday</span>
          <span><i style={{ background: "var(--sp-ok)" }} />Buddy covering</span>
          <span><i style={{ background: "var(--sp-bad)" }} />Nobody covering</span>
        </div>
        {withAbsence.length === 0 ? (
          <div className="sp-empty">No one has leave or holidays in this sprint.</div>
        ) : (
          <div className="sp-tw">
            <table className="sp-cov">
              <thead>
                <tr>
                  <th>Person → buddy</th>
                  {days.map((d) => {
                    const h = dayHead(d);
                    return <th key={d}>{h.dow}<br />{h.num}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {withAbsence.map((p) => {
                  const bp = byUser.get(p.user_id)!;
                  return (
                    <tr key={p.user_id}>
                      <td>
                        <b>{p.profile.full_name}</b>
                        <br />
                        <span className="note">→ {bp.buddy_user_ids.length ? bp.buddy_user_ids.map((b) => nameById.get(b) ?? "?").join(", ") : "no buddy"}</span>
                      </td>
                      {days.map((d) => {
                        const cov = coverageState(bp, d, byUser, idx);
                        const cell = dayCell(d, bp.location, bp.availability, idx);
                        let cls = "sp-cv";
                        let text = cell.kind === "half" ? "½" : "";
                        let title = "Working";
                        if (cell.kind === "half") cls += " half";
                        if (cov.state === "holiday") { cls = "sp-cv hol"; text = "H"; title = cell.kind === "holiday" ? cell.name : "Holiday"; }
                        else if (cov.state === "covered") {
                          const who = cov.coveredBy ? nameById.get(cov.coveredBy) ?? "" : "";
                          cls = "sp-cv cov"; text = initials(who); title = `Covered by ${who}`;
                        } else if (cov.state === "uncovered") { cls = "sp-cv risk"; text = "✕"; title = "Away, nobody covering"; }
                        return <td key={d}><span className={cls} title={title}>{text}</span></td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sp-alerts">
        {gaps.length === 0 ? (
          <div className="sp-alert ok"><span className="ic">✓</span><span>Every absence this sprint has a buddy covering.</span></div>
        ) : (
          gaps.map((g) => (
            <div key={`${g.userId}-${g.date}`} className="sp-alert bad">
              <span className="ic">!!</span>
              <span>
                <b>{g.name}</b> is away on {dayHead(g.date).long}
                {g.reason === "no-buddy" ? " and has no buddy set." : " and every buddy is away too."}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
