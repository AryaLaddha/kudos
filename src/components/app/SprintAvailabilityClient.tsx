"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Trash2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addPublicHoliday,
  deletePublicHoliday,
  saveAvailability,
  type AvailabilityRow,
} from "@/app/(app)/sprints/planning-actions";
import {
  LOCATIONS,
  dayCell,
  expectedPoints,
  holidayIndex,
  nextAvailability,
  totalAvailability,
  workingDays,
  type DayCell,
  type PlanningParticipant,
} from "@/lib/sprintAvailability";
import type { AvailabilityMap, PublicHoliday, Stream } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  sprint: { id: string; start_date: string; end_date: string };
  participants: PlanningParticipant[];
  streams: Stream[];
  holidays: PublicHoliday[];
  setHolidays: React.Dispatch<React.SetStateAction<PublicHoliday[]>>;
  onPatchParticipant: (userId: string, patch: Partial<Omit<PlanningParticipant, "profile">>) => void;
}

const selectCls =
  "h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

function dayLabel(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    dow: d.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" }).slice(0, 1),
    num: d.getUTCDate(),
    full: d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }),
    newWeek: d.getUTCDay() === 1,
  };
}

function cellStyle(c: DayCell) {
  switch (c.kind) {
    case "full": return "bg-indigo-100 text-indigo-800 hover:bg-indigo-200";
    case "half": return "bg-indigo-50 text-indigo-700 hover:bg-indigo-100";
    case "off": return "bg-slate-100 text-slate-400 hover:bg-slate-200";
    case "leave": return "bg-amber-100 text-amber-800 hover:bg-amber-200";
    case "holiday": return "bg-violet-100 text-violet-700 cursor-not-allowed";
  }
}

function cellText(c: DayCell) {
  if (c.kind === "leave") return "AL";
  if (c.kind === "holiday") return "H";
  if (c.kind === "half") return "½";
  return String(c.value);
}

export default function SprintAvailabilityClient({ sprint, participants, streams, holidays, setHolidays, onPatchParticipant }: Props) {
  const [, startTransition] = useTransition();
  const [locFilter, setLocFilter] = useState("all");
  const [streamFilter, setStreamFilter] = useState("all");
  const [hLoc, setHLoc] = useState<string>(LOCATIONS[0]);
  const [hDate, setHDate] = useState("");
  const [hName, setHName] = useState("");
  const [hSaving, setHSaving] = useState(false);

  const days = useMemo(() => workingDays(sprint.start_date, sprint.end_date), [sprint.start_date, sprint.end_date]);
  const holidayIdx = useMemo(() => holidayIndex(holidays), [holidays]);
  const streamName = useMemo(() => new Map(streams.map((s) => [s.id, s.name])), [streams]);
  const nameById = useMemo(() => new Map(participants.map((p) => [p.user_id, p.profile.full_name])), [participants]);

  const sprintHolidays = useMemo(
    () => holidays.filter((h) => h.holiday_date >= sprint.start_date && h.holiday_date <= sprint.end_date),
    [holidays, sprint.start_date, sprint.end_date],
  );

  const visible = participants.filter((p) => {
    if (locFilter !== "all" && (p.location ?? "") !== (locFilter === "none" ? "" : locFilter)) return false;
    if (streamFilter !== "all" && !p.stream_ids.includes(streamFilter)) return false;
    return true;
  });
  const teamExpected = visible.reduce((s, p) => s + (p.expected_override ?? 0), 0);

  function buildRow(p: PlanningParticipant, patch: Partial<Omit<PlanningParticipant, "profile">>, idx = holidayIdx): AvailabilityRow {
    const location = patch.location !== undefined ? patch.location : (p.location ?? null);
    const deducted = patch.deducted_points ?? p.deducted_points ?? 0;
    const availability = patch.availability ?? p.availability ?? {};
    const buddies = patch.buddy_user_ids ?? p.buddy_user_ids ?? [];
    return {
      user_id: p.user_id,
      location,
      buddy_user_ids: buddies,
      deducted_points: deducted,
      availability,
      expected_override: expectedPoints(totalAvailability(days, location, availability, idx), deducted),
    };
  }

  function commit(rows: AvailabilityRow[]) {
    for (const r of rows) {
      onPatchParticipant(r.user_id, {
        location: r.location,
        buddy_user_ids: r.buddy_user_ids,
        deducted_points: r.deducted_points,
        availability: r.availability,
        expected_override: r.expected_override,
      });
    }
    startTransition(async () => {
      const res = await saveAvailability(sprint.id, rows);
      if (res.error) toast.error(res.error);
    });
  }

  function update(p: PlanningParticipant, patch: Partial<Omit<PlanningParticipant, "profile">>) {
    commit([buildRow(p, patch)]);
  }

  function cycleDay(p: PlanningParticipant, date: string) {
    const current = dayCell(date, p.location ?? null, p.availability ?? {}, holidayIdx);
    if (current.kind === "holiday") return;
    const next = nextAvailability(current);
    const availability: AvailabilityMap = { ...(p.availability ?? {}) };
    if (next === undefined) delete availability[date];
    else availability[date] = next;
    update(p, { availability });
  }

  function addBuddy(p: PlanningParticipant, buddyId: string) {
    if (!buddyId) return;
    const cur = p.buddy_user_ids ?? [];
    if (cur.includes(buddyId)) return;
    update(p, { buddy_user_ids: [...cur, buddyId] });
  }

  function removeBuddy(p: PlanningParticipant, buddyId: string) {
    update(p, { buddy_user_ids: (p.buddy_user_ids ?? []).filter((b) => b !== buddyId) });
  }

  // A holiday change moves everyone at that location, so recalculate and save them together.
  function recalcLocation(location: string, nextHolidays: PublicHoliday[]) {
    const idx = holidayIndex(nextHolidays);
    const rows = participants.filter((p) => p.location === location).map((p) => buildRow(p, {}, idx));
    if (rows.length > 0) commit(rows);
  }

  async function handleAddHoliday() {
    setHSaving(true);
    const res = await addPublicHoliday({ location: hLoc, holiday_date: hDate, name: hName });
    setHSaving(false);
    if (res.error || !res.holiday) { toast.error(res.error ?? "Something went wrong."); return; }
    const saved = res.holiday;
    const next = [...holidays.filter((h) => !(h.location === saved.location && h.holiday_date === saved.holiday_date)), saved];
    setHolidays(next);
    recalcLocation(saved.location, next);
    setHDate("");
    setHName("");
    toast.success(`Added ${saved.name} for ${saved.location}`);
  }

  async function handleDeleteHoliday(h: PublicHoliday) {
    const res = await deletePublicHoliday(h.id);
    if (res.error) { toast.error(res.error); return; }
    const next = holidays.filter((x) => x.id !== h.id);
    setHolidays(next);
    recalcLocation(h.location, next);
  }

  return (
    <div className="space-y-5">
      {/* Filters + legend */}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter by location" value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className={selectCls}>
          <option value="all">All locations</option>
          {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          <option value="none">No location set</option>
        </select>
        <select aria-label="Filter by stream" value={streamFilter} onChange={(e) => setStreamFilter(e.target.value)} className={selectCls}>
          <option value="all">All streams</option>
          {streams.filter((s) => !s.is_archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="text-xs text-slate-500">
          Click a day to cycle full → half → off → approved leave. Public holidays come from the location.
        </span>
        <span className="ml-auto text-xs font-semibold text-slate-700">
          Team expected: <span className="text-indigo-600">{Math.round(teamExpected * 10) / 10} pts</span>
        </span>
      </div>

      {/* Holidays */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-bold text-slate-900">Public holidays</h3>
          <span className="text-xs text-slate-400">{sprintHolidays.length} in this sprint</span>
        </div>
        {sprintHolidays.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-2">
            {sprintHolidays.map((h) => (
              <li key={h.id} className="inline-flex items-center gap-2 rounded-lg bg-violet-50 px-2.5 py-1 text-xs text-violet-800">
                <span className="font-bold">{h.location}</span>
                <span>{h.name}</span>
                <span className="text-violet-500">{dayLabel(h.holiday_date).full}</span>
                <button aria-label={`Remove ${h.name}`} onClick={() => handleDeleteHoliday(h)} className="text-violet-400 hover:text-red-500">
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Holiday location" value={hLoc} onChange={(e) => setHLoc(e.target.value)} className={selectCls}>
            {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <Input type="date" aria-label="Holiday date" value={hDate} onChange={(e) => setHDate(e.target.value)} className="h-8 w-40 text-xs" />
          <Input aria-label="Holiday name" value={hName} onChange={(e) => setHName(e.target.value)} placeholder="e.g. Dussehra" maxLength={80} className="h-8 w-48 text-xs" />
          <Button size="sm" onClick={handleAddHoliday} disabled={hSaving || !hDate || !hName.trim()} className="h-8 gap-1 bg-violet-600 text-xs text-white hover:bg-violet-700">
            {hSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add holiday
          </Button>
        </div>
      </div>

      {/* People */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          No one matches these filters. Add people from the Capacity Planning tab.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((p) => {
            const available = totalAvailability(days, p.location ?? null, p.availability ?? {}, holidayIdx);
            const deducted = p.deducted_points ?? 0;
            const buddies = p.buddy_user_ids ?? [];
            return (
              <article key={p.user_id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-[10rem] flex-1">
                    <p className="text-sm font-bold text-slate-900">{p.profile.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {[p.role, ...p.stream_ids.map((id) => streamName.get(id)).filter(Boolean)].filter(Boolean).join(" · ") || "No role or stream yet"}
                    </p>
                  </div>
                  <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Location
                    <select value={p.location ?? ""} onChange={(e) => update(p, { location: e.target.value || null })} className={selectCls}>
                      <option value="">Not set</option>
                      {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Deducted
                    <Input
                      type="number" min={0} step={0.5}
                      defaultValue={deducted}
                      key={`${p.user_id}-${deducted}`}
                      onBlur={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        if (v !== deducted) update(p, { deducted_points: v });
                      }}
                      className="h-8 w-20 text-xs"
                    />
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Expected</span>
                    <span className="h-8 content-center text-lg font-extrabold leading-8 text-indigo-600">
                      {Math.round((p.expected_override ?? 0) * 10) / 10}
                    </span>
                  </div>
                </div>

                <div className="px-4 py-3">
                  <div className="overflow-x-auto">
                    <div className="flex min-w-max items-end gap-1">
                      {days.map((d) => {
                        const l = dayLabel(d);
                        const c = dayCell(d, p.location ?? null, p.availability ?? {}, holidayIdx);
                        return (
                          <div key={d} className={cn("flex w-10 flex-col items-center gap-1", l.newWeek && "ml-2")}>
                            <span className="text-[10px] leading-tight text-slate-400">{l.dow}<br />{l.num}</span>
                            <button
                              type="button"
                              onClick={() => cycleDay(p, d)}
                              disabled={c.kind === "holiday"}
                              title={c.kind === "holiday" ? `${c.name} (${p.location})` : l.full}
                              aria-label={`${p.profile.full_name}, ${l.full}: ${cellText(c)}`}
                              className={cn("h-8 w-10 rounded-md text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500", cellStyle(c))}
                            >
                              {cellText(c)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Σ availability <b className="text-slate-700">{Math.round(available * 10) / 10}</b> − deducted{" "}
                    <b className="text-slate-700">{deducted}</b> = <b className="text-indigo-600">{expectedPoints(available, deducted)}</b> pts
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Buddy</span>
                    {buddies.length === 0 && <span className="text-xs text-slate-400">None</span>}
                    {buddies.map((b) => (
                      <span key={b} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {nameById.get(b) ?? "Unknown"}
                        <button aria-label={`Remove buddy ${nameById.get(b) ?? ""}`} onClick={() => removeBuddy(p, b)} className="text-slate-400 hover:text-red-500">×</button>
                      </span>
                    ))}
                    <select
                      aria-label={`Add buddy for ${p.profile.full_name}`}
                      value=""
                      onChange={(e) => addBuddy(p, e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Add buddy…</option>
                      {participants
                        .filter((o) => o.user_id !== p.user_id && !buddies.includes(o.user_id))
                        .map((o) => <option key={o.user_id} value={o.user_id}>{o.profile.full_name}</option>)}
                    </select>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
