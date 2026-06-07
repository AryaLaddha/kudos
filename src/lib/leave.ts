import type { LeaveType } from "@/types";

// ── Leave type catalogue ──────────────────────────────────────────────────────
// Single source of truth for the labels, legend dot colour, and pill styling of
// each leave type. Colours mirror the design mockup.

export type LeaveTypeMeta = {
  value: LeaveType;
  label: string;
  /** Solid colour used for the legend dot. */
  dot: string;
  /** Pill background + text classes (inline-styled to match the mockup palette). */
  pillBg: string;
  pillText: string;
};

export const LEAVE_TYPES: LeaveTypeMeta[] = [
  { value: "annual",          label: "Annual Leave",   dot: "#7C3AED", pillBg: "#EDE9FE", pillText: "#5B21B6" },
  { value: "sick",            label: "Sick Leave",     dot: "#2563EB", pillBg: "#DBEAFE", pillText: "#1E40AF" },
  { value: "public_holiday",  label: "Public Holiday", dot: "#D97706", pillBg: "#FEF3C7", pillText: "#92400E" },
  { value: "emergency",       label: "Emergency",      dot: "#DC2626", pillBg: "#FEE2E2", pillText: "#991B1B" },
  { value: "custom",          label: "Custom",         dot: "#6B7280", pillBg: "#F1F5F9", pillText: "#334155" },
];

const TYPE_BY_VALUE = new Map(LEAVE_TYPES.map((t) => [t.value, t]));

export function leaveTypeMeta(type: LeaveType): LeaveTypeMeta {
  return TYPE_BY_VALUE.get(type) ?? LEAVE_TYPES[LEAVE_TYPES.length - 1];
}

/** Short label shown on a calendar pill, e.g. "Annual" or the custom label. */
export function leaveShortLabel(type: LeaveType, customLabel?: string | null): string {
  if (type === "custom") return customLabel?.trim() || "Custom";
  if (type === "public_holiday") return "Public Hol.";
  return leaveTypeMeta(type).label.replace(/ Leave$/, "");
}

// ── Date helpers (timezone-safe, date-only) ───────────────────────────────────
// All dates are handled as local YYYY-MM-DD strings to avoid UTC drift.

export function toDateKey(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Parse a YYYY-MM-DD string into local Y/M/D parts (no Date/TZ involved). */
export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

/** True for Saturday/Sunday given a date key. Uses UTC construction purely for weekday math. */
export function isWeekendKey(key: string): boolean {
  const { year, month, day } = parseDateKey(key);
  const dow = new Date(Date.UTC(year, month, day)).getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Expand a leave range into the set of weekday date keys it covers.
 * Weekends are excluded to match the calendar's working-day semantics.
 */
export function expandLeaveDays(startKey: string, endKey: string): string[] {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const days: string[] = [];
  const cursor = new Date(Date.UTC(start.year, start.month, start.day));
  const last = new Date(Date.UTC(end.year, end.month, end.day));
  // Guard against accidental huge ranges.
  let guard = 0;
  while (cursor <= last && guard < 1000) {
    const key = toDateKey(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate());
    if (!isWeekendKey(key)) days.push(key);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }
  return days;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
