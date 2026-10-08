import type { AvailabilityMap, AvailabilityValue, GoalAssignment, PublicHoliday, SprintGoal } from "@/types";

export const LOCATIONS = ["AU", "PH", "IN", "Midcai"] as const;

const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Mon-Fri dates (YYYY-MM-DD) from start to end inclusive. */
export function workingDays(start: string, end: string): string[] {
  const out: string[] = [];
  const first = new Date(`${start}T00:00:00Z`).getTime();
  const last = new Date(`${end}T00:00:00Z`).getTime();
  for (let t = first; t <= last; t += DAY_MS) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export type HolidayIndex = Map<string, Map<string, string>>; // location -> date -> name

export function holidayIndex(holidays: PublicHoliday[]): HolidayIndex {
  const idx: HolidayIndex = new Map();
  for (const h of holidays) {
    if (!idx.has(h.location)) idx.set(h.location, new Map());
    idx.get(h.location)!.set(h.holiday_date, h.name);
  }
  return idx;
}

export type DayCell =
  | { kind: "full" | "half" | "off"; value: number }
  | { kind: "leave"; value: 0 }
  | { kind: "holiday"; value: 0; name: string };

/** A public holiday beats any entered availability; an entry beats the default full day. */
export function dayCell(
  date: string,
  location: string | null,
  availability: AvailabilityMap,
  holidays: HolidayIndex,
): DayCell {
  const hol = location ? holidays.get(location)?.get(date) : undefined;
  if (hol) return { kind: "holiday", value: 0, name: hol };
  const v: AvailabilityValue | undefined = availability[date];
  if (v === "AL") return { kind: "leave", value: 0 };
  if (v === undefined || v >= 1) return { kind: "full", value: 1 };
  if (v > 0) return { kind: "half", value: v };
  return { kind: "off", value: 0 };
}

export function isAway(c: DayCell) {
  return c.value === 0;
}

/** Sum of daily availability across the sprint's working days. */
export function totalAvailability(
  days: string[],
  location: string | null,
  availability: AvailabilityMap,
  holidays: HolidayIndex,
): number {
  return days.reduce((s, d) => s + dayCell(d, location, availability, holidays).value, 0);
}

/** Expected points = sum of availability - deducted, never below zero. */
export function expectedPoints(available: number, deducted: number): number {
  return Math.max(0, round1(available - (deducted || 0)));
}

/**
 * Click cycle for one day: full -> half -> off -> approved leave -> full.
 * Returns the new override, or undefined to clear it (back to a full day).
 * Holidays are not editable.
 */
export function nextAvailability(current: DayCell): AvailabilityValue | undefined {
  switch (current.kind) {
    case "full": return 0.5;
    case "half": return 0;
    case "off": return "AL";
    default: return undefined;
  }
}

export type BuddyPerson = {
  user_id: string;
  location: string | null;
  availability: AvailabilityMap;
  buddy_user_ids: string[];
};

export type BuddyDayState = "working" | "holiday" | "covered" | "uncovered";

/** For one person on one date: are they away, and does any buddy cover them? */
export function coverageState(
  person: BuddyPerson,
  date: string,
  byUser: Map<string, BuddyPerson>,
  holidays: HolidayIndex,
): { state: BuddyDayState; coveredBy: string | null } {
  const mine = dayCell(date, person.location, person.availability, holidays);
  if (mine.kind === "holiday") return { state: "holiday", coveredBy: null };
  if (!isAway(mine)) return { state: "working", coveredBy: null };
  for (const bid of person.buddy_user_ids) {
    const b = byUser.get(bid);
    if (b && !isAway(dayCell(date, b.location, b.availability, holidays))) return { state: "covered", coveredBy: bid };
  }
  return { state: "uncovered", coveredBy: null };
}

export type StreamTotals = { streamId: string | null; capacity: number; allocated: number };

/** Capacity and allocated points per stream. A multi-stream person is split evenly so totals add up. */
export function streamTotals(
  participants: { user_id: string; expected_override: number | null; stream_ids: string[] }[],
  assignments: GoalAssignment[],
): StreamTotals[] {
  const allocatedByUser = new Map<string, number>();
  for (const a of assignments) {
    allocatedByUser.set(a.user_id, (allocatedByUser.get(a.user_id) ?? 0) + (a.allocated_points || 0));
  }
  const map = new Map<string | null, StreamTotals>();
  for (const p of participants) {
    const ids = p.stream_ids.length > 0 ? p.stream_ids : [null];
    const share = 1 / ids.length;
    for (const sid of ids) {
      const row = map.get(sid) ?? { streamId: sid, capacity: 0, allocated: 0 };
      row.capacity += (p.expected_override ?? 0) * share;
      row.allocated += (allocatedByUser.get(p.user_id) ?? 0) * share;
      map.set(sid, row);
    }
  }
  return [...map.values()].map((r) => ({ ...r, capacity: round1(r.capacity), allocated: round1(r.allocated) }));
}

/** Open goals with no one assigned to any role. */
export function goalsWithoutPeople(goals: SprintGoal[], assignments: GoalAssignment[]): SprintGoal[] {
  const withPeople = new Set(assignments.map((a) => a.goal_id));
  return goals.filter((g) => g.status !== "completed" && !withPeople.has(g.id));
}

/** The participant fields the planning tabs read. Planning columns are optional until the migration has run. */
export interface PlanningParticipant {
  user_id: string;
  role: string | null;
  stream_ids: string[];
  expected_override: number | null;
  location?: string | null;
  buddy_user_ids?: string[];
  deducted_points?: number;
  availability?: AvailabilityMap;
  profile: { full_name: string; avatar_url: string | null };
}

export function toBuddyPerson(p: PlanningParticipant): BuddyPerson {
  return {
    user_id: p.user_id,
    location: p.location ?? null,
    availability: p.availability ?? {},
    buddy_user_ids: p.buddy_user_ids ?? [],
  };
}
