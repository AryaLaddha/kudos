// ── Date helpers (timezone-safe, date-only) ───────────────────────────────────
// All dates are handled as local YYYY-MM-DD strings to avoid UTC drift.
// (This module predates the removal of the leave calendar; it now holds the
// generic date formatters used by the sprint goal & capacity views.)

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

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBR = MONTH_NAMES.map((m) => m.slice(0, 3));

/** "Jan 20" */
export function formatShortDate(key: string): string {
  const { month, day } = parseDateKey(key);
  return `${MONTH_ABBR[month]} ${day}`;
}

/** "Jan 20" · "Feb 3–4" (same month) · "Feb 27 – Mar 3" (cross month) */
export function formatDateRange(startKey: string, endKey: string): string {
  if (startKey === endKey) return formatShortDate(startKey);
  const a = parseDateKey(startKey);
  const b = parseDateKey(endKey);
  if (a.month === b.month && a.year === b.year) {
    return `${MONTH_ABBR[a.month]} ${a.day}–${b.day}`;
  }
  return `${formatShortDate(startKey)} – ${formatShortDate(endKey)}`;
}
