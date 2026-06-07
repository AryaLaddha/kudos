"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import AddLeaveDialog from "@/components/app/AddLeaveDialog";
import { deleteLeave } from "@/app/(app)/leave/actions";
import {
  LEAVE_TYPES,
  MONTH_NAMES,
  expandLeaveDays,
  isWeekendKey,
  leaveShortLabel,
  leaveTypeMeta,
  toDateKey,
} from "@/lib/leave";
import type { Leave } from "@/types";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

interface Props {
  leaves: Leave[];
  orgId: string;
  currentUserId: string;
}

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function LeaveCalendarClient({ leaves: initialLeaves, orgId, currentUserId }: Props) {
  const today = new Date();
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const [leaves, setLeaves] = useState<Leave[]>(initialLeaves);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaultDate, setAddDefaultDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<Leave | null>(null);
  const [isDeleting, startDelete] = useTransition();

  // Map of date-key → leaves falling on that working day.
  const leavesByDay = useMemo(() => {
    const map = new Map<string, Leave[]>();
    for (const leave of leaves) {
      for (const key of expandLeaveDays(leave.start_date, leave.end_date)) {
        const list = map.get(key);
        if (list) list.push(leave);
        else map.set(key, [leave]);
      }
    }
    return map;
  }, [leaves]);

  // Build the Monday-first grid for the visible month.
  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
    const leading = (firstDow + 6) % 7; // Monday-first offset
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  }

  function goToday() {
    setMonth(today.getMonth());
    setYear(today.getFullYear());
  }

  function openAdd(date?: string) {
    setAddDefaultDate(date ?? null);
    setAddOpen(true);
  }

  function handleAdded(leave: Leave) {
    setLeaves((prev) => [...prev, leave]);
  }

  function handleDelete(leave: Leave) {
    startDelete(async () => {
      const result = await deleteLeave(leave.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setLeaves((prev) => prev.filter((l) => l.id !== leave.id));
      setSelected(null);
      toast.success("Leave removed.");
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
          <CalendarDays className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Leave Calendar</h1>
          <p className="text-sm text-slate-500">See who&apos;s out across the team</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <button
            onClick={() => changeMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-extrabold text-slate-900 min-w-[160px] text-center">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={() => changeMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToday}
            className="h-8 border-slate-200 text-xs"
          >
            Today
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={() => openAdd()}
            className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            Add My Leave
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Leave types:</span>
          {LEAVE_TYPES.map((t) => (
            <span key={t.value} className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.dot }} />
              {t.label}
            </span>
          ))}
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAY_HEADERS.map((d, i) => (
            <div
              key={d}
              className={`py-2 text-center text-[11px] font-bold uppercase tracking-wide ${
                i >= 5 ? "text-slate-300" : "text-slate-500"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`e-${idx}`} className="min-h-[92px] border-b border-r border-slate-100 bg-slate-50/40 [&:nth-child(7n)]:border-r-0" />;
            }
            const key = toDateKey(year, month, day);
            const weekend = isWeekendKey(key);
            const isToday = key === todayKey;
            const dayLeaves = leavesByDay.get(key) ?? [];

            return (
              <div
                key={key}
                className={`group relative min-h-[92px] border-b border-r border-slate-100 px-2 py-1.5 [&:nth-child(7n)]:border-r-0 ${
                  weekend ? "bg-slate-50" : "bg-white"
                }`}
              >
                <div className="mb-1 flex items-center">
                  <span
                    className={`flex h-[22px] w-[22px] items-center justify-center text-xs font-bold ${
                      isToday
                        ? "rounded-full bg-indigo-600 text-white"
                        : weekend
                        ? "text-slate-400"
                        : "text-slate-700"
                    }`}
                  >
                    {day}
                  </span>
                </div>

                <div className="space-y-1">
                  {dayLeaves.map((leave) => {
                    const meta = leaveTypeMeta(leave.leave_type);
                    const mine = leave.user_id === currentUserId;
                    return (
                      <button
                        key={`${leave.id}-${key}`}
                        type="button"
                        onClick={() => setSelected(leave)}
                        title={`${leave.user_name} — ${leaveShortLabel(leave.leave_type, leave.custom_label)}${mine ? " (your leave)" : ""}`}
                        style={{ background: meta.pillBg, color: meta.pillText }}
                        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium hover:opacity-80 ${
                          mine ? "ring-1 ring-inset ring-black/10" : ""
                        }`}
                      >
                        {leave.user_name?.split(" ")[0]} — {leaveShortLabel(leave.leave_type, leave.custom_label)}
                      </button>
                    );
                  })}
                </div>

                {!weekend && (
                  <button
                    type="button"
                    onClick={() => openAdd(key)}
                    className="absolute bottom-1.5 right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded bg-slate-100 text-slate-400 opacity-0 transition-opacity hover:bg-indigo-100 hover:text-indigo-600 group-hover:opacity-100"
                    aria-label={`Add leave on ${key}`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add leave dialog */}
      <AddLeaveDialog
        key={addDefaultDate ?? "add"}
        open={addOpen}
        onOpenChange={setAddOpen}
        orgId={orgId}
        defaultDate={addDefaultDate}
        onSuccess={handleAdded}
      />

      {/* Leave details dialog */}
      <Dialog open={selected !== null} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-sm w-full">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ background: leaveTypeMeta(selected.leave_type).dot }}
                  />
                  {leaveShortLabel(selected.leave_type, selected.custom_label)}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5 text-sm">
                <p className="text-slate-700">
                  <span className="font-semibold">{selected.user_name}</span>
                  {selected.user_id === currentUserId && (
                    <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                      You
                    </span>
                  )}
                </p>
                <p className="text-slate-500">
                  {selected.start_date === selected.end_date
                    ? selected.start_date
                    : `${selected.start_date} → ${selected.end_date}`}
                </p>
              </div>
              {selected.user_id === currentUserId && (
                <DialogFooter showCloseButton>
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(selected)}
                    disabled={isDeleting}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isDeleting ? "Removing…" : "Remove leave"}
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
