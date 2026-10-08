"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addPublicHoliday,
  deletePublicHoliday,
  saveAvailability,
  type AvailabilityRow,
} from "@/app/(app)/sprints/planning-actions";
import { addSprintMember, assignRole, unassignRole, updateParticipantCapacity } from "@/app/(app)/sprints/goals-actions";
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
import { formatRolePoints } from "@/lib/sprintGoals";
import type { AvailabilityMap, CapacityRoleDefinition, GoalAssignment, PublicHoliday, SprintGoal, Stream } from "@/types";
import { toast } from "sonner";

type Patch = Partial<Omit<PlanningParticipant, "profile">>;
interface OrgUser { id: string; full_name: string }

interface Props {
  sprint: { id: string; start_date: string; end_date: string };
  participants: PlanningParticipant[];
  goals: SprintGoal[];
  streams: Stream[];
  roles: CapacityRoleDefinition[];
  assignments: GoalAssignment[];
  setAssignments: React.Dispatch<React.SetStateAction<GoalAssignment[]>>;
  holidays: PublicHoliday[];
  setHolidays: React.Dispatch<React.SetStateAction<PublicHoliday[]>>;
  orgUsers: OrgUser[];
  onPatchParticipant: (userId: string, patch: Patch) => void;
  onMemberUpserted: (userId: string, role: string | null, expected: number | null) => void;
  onRemoveMember: (userId: string) => void;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

function dayLabel(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    dow: d.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" }).slice(0, 1),
    num: d.getUTCDate(),
    full: d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }),
    newWeek: d.getUTCDay() === 1,
  };
}

function cellClass(c: DayCell) {
  return c.kind === "full" ? "sp-cell" : c.kind === "half" ? "sp-cell half" : c.kind === "off" ? "sp-cell off" : c.kind === "leave" ? "sp-cell al" : "sp-cell hol";
}
function cellText(c: DayCell) {
  return c.kind === "leave" ? "AL" : c.kind === "holiday" ? "H" : c.kind === "half" ? "½" : String(c.value);
}

export default function SprintCapacityClient({
  sprint, participants, goals, streams, roles, assignments, setAssignments, holidays, setHolidays, orgUsers,
  onPatchParticipant, onMemberUpserted, onRemoveMember,
}: Props) {
  const [, startTransition] = useTransition();
  const [locFilter, setLocFilter] = useState("all");
  const [streamFilter, setStreamFilter] = useState("all");
  const [hLoc, setHLoc] = useState<string>(LOCATIONS[0]);
  const [hDate, setHDate] = useState("");
  const [hName, setHName] = useState("");
  const [addUser, setAddUser] = useState("");
  const [addRole, setAddRole] = useState("");
  const [adding, setAdding] = useState(false);

  const days = useMemo(() => workingDays(sprint.start_date, sprint.end_date), [sprint.start_date, sprint.end_date]);
  const holidayIdx = useMemo(() => holidayIndex(holidays), [holidays]);
  const streamName = useMemo(() => new Map(streams.map((s) => [s.id, s.name])), [streams]);
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const nameById = useMemo(() => new Map(participants.map((p) => [p.user_id, p.profile.full_name])), [participants]);
  const activeRoles = roles.filter((r) => !r.is_archived);
  const activeStreams = streams.filter((s) => !s.is_archived);
  const sprintHolidays = useMemo(
    () => holidays.filter((h) => h.holiday_date >= sprint.start_date && h.holiday_date <= sprint.end_date),
    [holidays, sprint.start_date, sprint.end_date],
  );

  const visible = participants.filter((p) => {
    if (locFilter !== "all" && (p.location ?? "") !== (locFilter === "none" ? "" : locFilter)) return false;
    if (streamFilter !== "all" && !p.stream_ids.includes(streamFilter)) return false;
    return true;
  });
  const plannedByUser = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assignments) m.set(a.user_id, (m.get(a.user_id) ?? 0) + (a.allocated_points || 0));
    return m;
  }, [assignments]);
  const teamExpected = r1(visible.reduce((s, p) => s + (p.expected_override ?? 0), 0));
  const teamPlanned = r1(visible.reduce((s, p) => s + (plannedByUser.get(p.user_id) ?? 0), 0));

  // ── Availability ──────────────────────────────────────────
  function buildRow(p: PlanningParticipant, patch: Patch, idx = holidayIdx): AvailabilityRow {
    const location = patch.location !== undefined ? patch.location : (p.location ?? null);
    const deducted = patch.deducted_points ?? p.deducted_points ?? 0;
    const availability = patch.availability ?? p.availability ?? {};
    return {
      user_id: p.user_id,
      location,
      buddy_user_ids: patch.buddy_user_ids ?? p.buddy_user_ids ?? [],
      deducted_points: deducted,
      availability,
      expected_override: expectedPoints(totalAvailability(days, location, availability, idx), deducted),
    };
  }

  function commit(rows: AvailabilityRow[]) {
    for (const r of rows) {
      onPatchParticipant(r.user_id, {
        location: r.location, buddy_user_ids: r.buddy_user_ids, deducted_points: r.deducted_points,
        availability: r.availability, expected_override: r.expected_override,
      });
    }
    startTransition(async () => {
      const res = await saveAvailability(sprint.id, rows);
      if (res.error) toast.error(res.error);
    });
  }
  const update = (p: PlanningParticipant, patch: Patch) => commit([buildRow(p, patch)]);

  function cycleDay(p: PlanningParticipant, date: string) {
    const current = dayCell(date, p.location ?? null, p.availability ?? {}, holidayIdx);
    if (current.kind === "holiday") return;
    const next = nextAvailability(current);
    const availability: AvailabilityMap = { ...(p.availability ?? {}) };
    if (next === undefined) delete availability[date]; else availability[date] = next;
    update(p, { availability });
  }

  function recalcLocation(location: string, nextHolidays: PublicHoliday[]) {
    const idx = holidayIndex(nextHolidays);
    const rows = participants.filter((p) => p.location === location).map((p) => buildRow(p, {}, idx));
    if (rows.length > 0) commit(rows);
  }

  async function handleAddHoliday() {
    const res = await addPublicHoliday({ location: hLoc, holiday_date: hDate, name: hName });
    if (res.error || !res.holiday) { toast.error(res.error ?? "Something went wrong."); return; }
    const saved = res.holiday;
    const next = [...holidays.filter((h) => !(h.location === saved.location && h.holiday_date === saved.holiday_date)), saved];
    setHolidays(next);
    recalcLocation(saved.location, next);
    setHDate(""); setHName("");
    toast.success(`Added ${saved.name} for ${saved.location}`);
  }

  async function handleDeleteHoliday(h: PublicHoliday) {
    const res = await deletePublicHoliday(h.id);
    if (res.error) { toast.error(res.error); return; }
    const next = holidays.filter((x) => x.id !== h.id);
    setHolidays(next);
    recalcLocation(h.location, next);
  }

  // ── Role + streams ────────────────────────────────────────
  function saveRoleStreams(p: PlanningParticipant, role: string | null, stream_ids: string[]) {
    onPatchParticipant(p.user_id, { role, stream_ids });
    startTransition(async () => {
      const res = await updateParticipantCapacity(sprint.id, p.user_id, { role, expected_override: p.expected_override, stream_ids });
      if (res.error) toast.error(res.error);
    });
  }

  async function handleAddPerson() {
    if (!addUser) return;
    setAdding(true);
    const res = await addSprintMember({ sprintId: sprint.id, userId: addUser, role: addRole, expectedPoints: null });
    setAdding(false);
    if (res.error) { toast.error(res.error); return; }
    onMemberUpserted(addUser, addRole || null, null);
    setAddUser(""); setAddRole("");
    toast.success("Added to sprint. Set their location and leave to calculate capacity.");
  }

  // ── Allocations ───────────────────────────────────────────
  function handleSetPoints(a: GoalAssignment, value: number) {
    if (!Number.isFinite(value) || value <= 0 || value === a.allocated_points) return;
    setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, allocated_points: value } : x)));
    startTransition(async () => {
      const res = await assignRole({
        sprintId: sprint.id, goalId: a.goal_id, roleRequirementId: a.role_requirement_id ?? "", role: a.role, userId: a.user_id, allocatedPoints: value,
      });
      if (res.error) { toast.error(res.error); setAssignments((prev) => prev.map((x) => (x.id === a.id ? a : x))); }
    });
  }

  function handleRemoveAssignment(a: GoalAssignment) {
    setAssignments((prev) => prev.filter((x) => x.id !== a.id));
    startTransition(async () => {
      const res = await unassignRole({ sprintId: sprint.id, goalId: a.goal_id, roleRequirementId: a.role_requirement_id ?? "" });
      if (res.error) { toast.error(res.error); setAssignments((prev) => [...prev, a]); }
    });
  }

  const notInSprint = orgUsers.filter((u) => !participants.some((p) => p.user_id === u.id));

  return (
    <div className="sp-screen">
      <div className="sp-toolbar">
        <select className="sp-select" aria-label="Filter by stream" value={streamFilter} onChange={(e) => setStreamFilter(e.target.value)}>
          <option value="all">All streams</option>
          {activeStreams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="sp-select" aria-label="Filter by location" value={locFilter} onChange={(e) => setLocFilter(e.target.value)}>
          <option value="all">All locations</option>
          {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          <option value="none">No location set</option>
        </select>
        <select className="sp-select" aria-label="Person to add" value={addUser} onChange={(e) => setAddUser(e.target.value)}>
          <option value="">+ Add person…</option>
          {notInSprint.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        {addUser && (
          <>
            <select className="sp-select" aria-label="Role for new person" value={addRole} onChange={(e) => setAddRole(e.target.value)}>
              <option value="">Role…</option>
              {activeRoles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
            <button className="sp-btn primary" disabled={adding} onClick={handleAddPerson}>Add to sprint</button>
          </>
        )}
        <span className="note">Click a day to cycle full → half → off → leave. Holidays come from the location.</span>
      </div>

      <div className="sp-panel">
        <h2>Public holidays <span className="note">{sprintHolidays.length} in this sprint</span></h2>
        {sprintHolidays.length > 0 && (
          <div className="sp-catalog">
            {sprintHolidays.map((h) => (
              <span key={h.id} className="sp-holi">
                <b>{h.location}</b> {h.name} · {dayLabel(h.holiday_date).full}
                <button className="sp-x" aria-label={`Remove ${h.name}`} onClick={() => handleDeleteHoliday(h)}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="sp-toolbar">
          <select className="sp-select" aria-label="Holiday location" value={hLoc} onChange={(e) => setHLoc(e.target.value)}>
            {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <input className="sp-input" type="date" aria-label="Holiday date" value={hDate} onChange={(e) => setHDate(e.target.value)} />
          <input className="sp-input" aria-label="Holiday name" placeholder="e.g. Dussehra" maxLength={80} value={hName} onChange={(e) => setHName(e.target.value)} />
          <button className="sp-btn" disabled={!hDate || !hName.trim()} onClick={handleAddHoliday}>Add holiday</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="sp-empty">No one matches these filters. Use &ldquo;+ Add person&rdquo; to bring people into this sprint.</div>
      ) : (
        visible.map((p) => {
          const available = totalAvailability(days, p.location ?? null, p.availability ?? {}, holidayIdx);
          const deducted = p.deducted_points ?? 0;
          const expected = p.expected_override ?? 0;
          const planned = r1(plannedByUser.get(p.user_id) ?? 0);
          const mine = assignments.filter((a) => a.user_id === p.user_id);
          const state = mine.length === 0 ? "none" : planned > expected ? "over" : planned < expected ? "under" : "ok";
          const buddies = p.buddy_user_ids ?? [];
          const openRows = goals
            .filter((g) => g.status !== "completed")
            .flatMap((g) => (g.role_requirements ?? [])
              .filter((r) => !assignments.some((a) => a.goal_id === g.id && a.role_requirement_id === r.id))
              .map((r) => ({ key: `${g.id}|${r.id}`, goal: g, req: r })));
          return (
            <article key={p.user_id} className={`sp-person${state === "over" ? " bad" : ""}`}>
              <div className="sp-ph">
                <div className="sp-who">
                  <span className="sp-avatar">{initials(p.profile.full_name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <b>{p.profile.full_name}</b>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 3 }}>
                      <select className="sp-select" aria-label="Role" value={p.role ?? ""} onChange={(e) => saveRoleStreams(p, e.target.value || null, p.stream_ids)}>
                        <option value="">No role</option>
                        {activeRoles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                        {p.role && !activeRoles.some((r) => r.name === p.role) && <option value={p.role}>{p.role}</option>}
                      </select>
                      <select
                        className="sp-select" aria-label="Add stream" value=""
                        onChange={(e) => e.target.value && saveRoleStreams(p, p.role, [...p.stream_ids, e.target.value])}
                      >
                        <option value="">+ Stream</option>
                        {activeStreams.filter((s) => !p.stream_ids.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {p.stream_ids.map((id) => (
                        <span key={id} className="sp-chip">
                          {streamName.get(id) ?? "Stream"}
                          <button className="sp-x" aria-label="Remove stream" onClick={() => saveRoleStreams(p, p.role, p.stream_ids.filter((x) => x !== id))}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <label className="sp-label">
                  Location
                  <select className="sp-select" value={p.location ?? ""} onChange={(e) => update(p, { location: e.target.value || null })}>
                    <option value="">Not set</option>
                    {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <label className="sp-label">
                  Deducted
                  <input
                    className="sp-input mono" style={{ width: 70 }} type="number" min={0} step={0.5}
                    key={`${p.user_id}-${deducted}`} defaultValue={deducted}
                    onBlur={(e) => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== deducted) update(p, { deducted_points: v }); }}
                  />
                </label>
                <div className="sp-stat">Expected<b>{r1(expected)}</b></div>
                <div className="sp-stat">
                  Planned
                  <b style={{ color: state === "ok" ? "var(--sp-ok)" : state === "over" ? "var(--sp-bad)" : "var(--sp-warn)" }}>
                    {mine.length ? `${planned}` : "—"}
                  </b>
                </div>
              </div>

              <div className="sp-pbody">
                <div className="sp-pcol">
                  <h3>Availability · {days.length} working days</h3>
                  <div className="sp-days">
                    {days.map((d) => {
                      const l = dayLabel(d);
                      const c = dayCell(d, p.location ?? null, p.availability ?? {}, holidayIdx);
                      return (
                        <div key={d} className={`sp-day${l.newWeek && d !== days[0] ? " wk" : ""}`}>
                          <span className="sp-dh">{l.dow}<br />{l.num}</span>
                          <button
                            type="button" className={cellClass(c)} disabled={c.kind === "holiday"}
                            title={c.kind === "holiday" ? `${c.name} (${p.location})` : l.full}
                            aria-label={`${p.profile.full_name}, ${l.full}: ${cellText(c)}`}
                            onClick={() => cycleDay(p, d)}
                          >
                            {cellText(c)}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="note" style={{ margin: "8px 0 0" }}>
                    Σ availability <b className="mono">{r1(available)}</b> − deducted <b className="mono">{deducted}</b> = <b className="mono">{expectedPoints(available, deducted)}</b> pts
                    {p.location && days.some((d) => holidayIdx.get(p.location!)?.has(d)) ? ` · ${p.location} holiday applied` : ""}
                  </p>
                  <div className="sp-addrow">
                    <span className="sp-label" style={{ flexDirection: "row", alignItems: "center" }}>Buddy</span>
                    {buddies.length === 0 && <span className="note">None</span>}
                    {buddies.map((b) => (
                      <span key={b} className="sp-chip">
                        {nameById.get(b) ?? "Unknown"}
                        <button className="sp-x" aria-label="Remove buddy" onClick={() => update(p, { buddy_user_ids: buddies.filter((x) => x !== b) })}>×</button>
                      </span>
                    ))}
                    <select
                      className="sp-select" aria-label={`Add buddy for ${p.profile.full_name}`} value=""
                      onChange={(e) => e.target.value && update(p, { buddy_user_ids: [...buddies, e.target.value] })}
                    >
                      <option value="">Add buddy…</option>
                      {participants.filter((o) => o.user_id !== p.user_id && !buddies.includes(o.user_id)).map((o) => <option key={o.user_id} value={o.user_id}>{o.profile.full_name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="sp-pcol">
                  <h3>Goal allocations</h3>
                  {mine.length === 0 ? (
                    <div className="sp-empty">No goals planned for {p.profile.full_name.split(" ")[0]} yet.</div>
                  ) : (
                    mine.map((a) => {
                      const g = goalById.get(a.goal_id);
                      return (
                        <div key={a.id} className="sp-task">
                          <div className="tn">
                            <b>{g?.title ?? "Goal"}</b>
                            <span>{a.role}{expected > 0 ? ` · ${Math.round((a.allocated_points / expected) * 100)}% of capacity` : ""}</span>
                          </div>
                          <input
                            className="sp-input mono" type="number" min={0.1} step={0.5} aria-label={`Points for ${g?.title ?? "goal"}`}
                            key={`${a.id}-${a.allocated_points}`} defaultValue={a.allocated_points}
                            onBlur={(e) => handleSetPoints(a, Number(e.target.value))}
                          />
                          <span className="pts mono">pts</span>
                          <button className="sp-x" aria-label="Remove allocation" onClick={() => handleRemoveAssignment(a)}>×</button>
                        </div>
                      );
                    })
                  )}
                  {mine.length > 0 && (
                    <div className="sp-sum">
                      <span className="note">Planned {planned} of {r1(expected)} pts</span>
                      <span className={`sp-pill ${state === "ok" ? "p-ok" : state === "over" ? "p-bad" : "p-warn"}`}>
                        {state === "ok" ? "Balanced" : state === "over" ? `Over by ${r1(planned - expected)}` : `Under by ${r1(expected - planned)}`}
                      </span>
                    </div>
                  )}
                  <AddAllocation
                    rows={openRows}
                    onAdd={(goalId, req, points) => {
                      startTransition(async () => {
                        const res = await assignRole({ sprintId: sprint.id, goalId, roleRequirementId: req.id, role: req.role, userId: p.user_id, allocatedPoints: points });
                        if (res.error || !res.assignment) { toast.error(res.error ?? "Something went wrong."); return; }
                        setAssignments((prev) => [...prev.filter((x) => x.id !== res.assignment!.id), res.assignment!]);
                      });
                    }}
                  />
                  <div style={{ marginTop: 10 }}>
                    <button className="sp-btn sm danger" onClick={() => { if (confirm(`Remove ${p.profile.full_name} from this sprint?`)) onRemoveMember(p.user_id); }}>Remove from sprint</button>
                  </div>
                </div>
              </div>
            </article>
          );
        })
      )}

      <div className="sp-teamtot">
        <span>Total expected points (shown)</span>
        <span className="mono">{teamPlanned} planned / {teamExpected} expected</span>
      </div>
    </div>
  );
}

function AddAllocation({
  rows, onAdd,
}: {
  rows: { key: string; goal: SprintGoal; req: { id: string; role: string; points: number | null } }[];
  onAdd: (goalId: string, req: { id: string; role: string; points: number | null }, points: number) => void;
}) {
  const [key, setKey] = useState("");
  const [points, setPoints] = useState("");
  const chosen = rows.find((r) => r.key === key);
  return (
    <div className="sp-addrow">
      <select
        className="sp-select" style={{ maxWidth: 260 }} aria-label="Goal and role to allocate" value={key}
        onChange={(e) => {
          setKey(e.target.value);
          const r = rows.find((x) => x.key === e.target.value);
          setPoints(r?.req.points ? String(r.req.points) : "");
        }}
      >
        <option value="">{rows.length ? "+ Allocate to goal…" : "No open role rows. Add roles to a goal first."}</option>
        {rows.map((r) => <option key={r.key} value={r.key}>{r.goal.title} · {r.req.role} {formatRolePoints(r.req.points)}</option>)}
      </select>
      {chosen && (
        <>
          <input className="sp-input mono" style={{ width: 72 }} type="number" min={0.1} step={0.5} aria-label="Points to allocate" value={points} onChange={(e) => setPoints(e.target.value)} />
          <button
            className="sp-btn primary" disabled={!(Number(points) > 0)}
            onClick={() => { onAdd(chosen.goal.id, chosen.req, Number(points)); setKey(""); setPoints(""); }}
          >
            Add
          </button>
        </>
      )}
    </div>
  );
}
