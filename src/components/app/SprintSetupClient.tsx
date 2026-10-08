"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cloneSprint, previewClone, type ClonePreview } from "@/app/(app)/sprints/planning-actions";
import { createRole, createStream, setRoleArchived, setStreamArchived } from "@/app/(app)/sprints/goals-actions";
import { workingDays } from "@/lib/sprintAvailability";
import type { CapacityRoleDefinition, PublicHoliday, Stream } from "@/types";
import { toast } from "sonner";

interface Props {
  sprint: { id: string; name: string; start_date: string; end_date: string };
  streams: Stream[];
  setStreams: React.Dispatch<React.SetStateAction<Stream[]>>;
  roles: CapacityRoleDefinition[];
  setRoles: React.Dispatch<React.SetStateAction<CapacityRoleDefinition[]>>;
  holidays: PublicHoliday[];
}

const DAY_MS = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Next Monday after the source sprint ends, running two weeks to Friday. */
function suggestedDates(sourceEnd: string) {
  let t = new Date(`${sourceEnd}T00:00:00Z`).getTime() + DAY_MS;
  while (new Date(t).getUTCDay() !== 1) t += DAY_MS;
  return { start: iso(t), end: iso(t + 11 * DAY_MS) };
}

/** "Sprint 16" -> "Sprint 17"; anything else gets " (next)" appended. */
function suggestedName(name: string) {
  const m = name.match(/^(.*?)(\d+)\s*$/);
  return m ? `${m[1]}${Number(m[2]) + 1}` : `${name} (next)`;
}

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function SprintSetupClient({ sprint, streams, setStreams, roles, setRoles, holidays }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const suggestion = useMemo(() => suggestedDates(sprint.end_date), [sprint.end_date]);
  const [name, setName] = useState(suggestedName(sprint.name));
  const [start, setStart] = useState(suggestion.start);
  const [end, setEnd] = useState(suggestion.end);
  const [copyAssignments, setCopyAssignments] = useState(true);
  const [preview, setPreview] = useState<ClonePreview | null>(null);

  useEffect(() => {
    if (!start || !end || end < start) return;
    let cancelled = false;
    previewClone(sprint.id, { start_date: start, end_date: end }).then((res) => {
      if (!cancelled) setPreview(res.preview ?? null);
    });
    return () => { cancelled = true; };
  }, [sprint.id, start, end]);

  const validDates = !!start && !!end && end >= start;
  const days = validDates ? workingDays(start, end) : [];
  const holidaysInNew = holidays.filter((h) => h.holiday_date >= start && h.holiday_date <= end);
  const thisDays = workingDays(sprint.start_date, sprint.end_date).length;

  function handleCreate() {
    startTransition(async () => {
      const res = await cloneSprint(sprint.id, { name, start_date: start, end_date: end, copyAssignments });
      if (res.error || !res.sprintId) { toast.error(res.error ?? "Something went wrong."); return; }
      toast.success(`Created ${name}`);
      router.push(`/sprints/${res.sprintId}`);
    });
  }

  return (
    <div className="sp-screen">
      <div className="sp-panel">
        <h2>This sprint <span className="note">{sprint.name}</span></h2>
        <div className="sp-diff"><span>Dates</span><b>{fmt(sprint.start_date)} – {fmt(sprint.end_date)}</b></div>
        <div className="sp-diff"><span>Working days</span><b className="mono">{thisDays}</b></div>
      </div>

      <div className="sp-steps">
        <div className="sp-panel">
          <h2>1. New sprint</h2>
          <label className="sp-label" style={{ marginBottom: 8 }}>
            Name
            <input className="sp-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="sp-label" style={{ marginBottom: 8 }}>
            Start
            <input className="sp-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="sp-label">
            End
            <input className="sp-input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <p className="note" style={{ marginBottom: 0 }}>
            {validDates ? `${days.length} working days.` : "Choose an end date on or after the start."}
            {holidaysInNew.length > 0 && ` ${holidaysInNew.map((h) => `${h.location} ${h.name}`).join(", ")} reduce capacity.`}
          </p>
        </div>

        <div className="sp-panel">
          <h2>2. Clone from {sprint.name}</h2>
          <div className="sp-chk"><input type="checkbox" checked readOnly disabled /> <span>People, roles, streams, buddies and default deductions {preview && <span className="sp-tag">{preview.people}</span>}</span></div>
          <label className="sp-chk">
            <input type="checkbox" checked={copyAssignments} onChange={(e) => setCopyAssignments(e.target.checked)} />
            <span>Role assignments for open goals that carry over {preview && <span className="sp-tag carry">{preview.assignments}</span>}</span>
          </label>
          <p className="note">Leave is date-specific, so it is not copied. Completed goals stay in History.</p>
        </div>

        <div className="sp-panel">
          <h2>3. Review</h2>
          {!preview || !validDates ? (
            <span className="note">Checking what carries over…</span>
          ) : (
            <>
              <div className="sp-diff"><span>Goals carried over</span><b>{preview.carriedGoals.length}</b></div>
              {preview.carriedGoals.length > 0 && <p className="note" style={{ margin: "4px 0" }}>{preview.carriedGoals.map((g) => g.title).join(", ")}</p>}
              {preview.droppedGoals.length > 0 && (
                <div className="sp-alert" style={{ marginTop: 8 }}>
                  <span className="ic">!</span>
                  <span>{preview.droppedGoals.length} open goals end before the new sprint and won&apos;t carry: {preview.droppedGoals.map((g) => g.title).join(", ")}. Extend their dates if they should.</span>
                </div>
              )}
            </>
          )}
          <button className="sp-btn primary" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} disabled={isPending || !name.trim() || !validDates} onClick={handleCreate}>
            {isPending ? "Creating…" : `Create ${name.trim() || "sprint"}`}
          </button>
        </div>
      </div>

      <div className="sp-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Catalog
          title="Streams"
          items={streams.map((s) => ({ id: s.id, name: s.name, archived: s.is_archived }))}
          onCreate={async (n) => {
            const res = await createStream(n);
            if (res.error || !res.stream) return res.error ?? "Something went wrong.";
            setStreams((prev) => [...prev, res.stream!].sort((a, b) => a.name.localeCompare(b.name)));
            return null;
          }}
          onArchive={async (id, archived) => {
            const res = await setStreamArchived(id, archived);
            if (res.error) return res.error;
            setStreams((prev) => prev.map((s) => (s.id === id ? { ...s, is_archived: archived } : s)));
            return null;
          }}
        />
        <Catalog
          title="Roles"
          items={roles.map((r) => ({ id: r.id, name: r.name, archived: r.is_archived }))}
          onCreate={async (n) => {
            const res = await createRole(n);
            if (res.error || !res.role) return res.error ?? "Something went wrong.";
            setRoles((prev) => [...prev, res.role!].sort((a, b) => a.name.localeCompare(b.name)));
            return null;
          }}
          onArchive={async (id, archived) => {
            const res = await setRoleArchived(id, archived);
            if (res.error) return res.error;
            setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, is_archived: archived } : r)));
            return null;
          }}
        />
      </div>
    </div>
  );
}

function Catalog({
  title, items, onCreate, onArchive,
}: {
  title: string;
  items: { id: string; name: string; archived: boolean }[];
  onCreate: (name: string) => Promise<string | null>;
  onArchive: (id: string, archived: boolean) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const active = items.filter((i) => !i.archived);
  const archived = items.filter((i) => i.archived);

  async function add() {
    const n = name.trim();
    if (!n) return;
    if (items.some((i) => i.name.toLowerCase() === n.toLowerCase())) { toast.error(`${title.slice(0, -1)} "${n}" already exists.`); return; }
    setBusy(true);
    const err = await onCreate(n);
    setBusy(false);
    if (err) toast.error(err); else setName("");
  }
  async function toggle(i: { id: string; archived: boolean }) {
    const err = await onArchive(i.id, !i.archived);
    if (err) toast.error(err);
  }

  return (
    <div className="sp-panel">
      <h2>{title} <span className="note">{active.length} active</span></h2>
      <div className="sp-catalog">
        {active.length === 0 && <span className="note">None yet.</span>}
        {active.map((i) => (
          <span key={i.id} className="sp-chip">{i.name}<button className="sp-x" aria-label={`Archive ${i.name}`} title="Archive" onClick={() => toggle(i)}>×</button></span>
        ))}
      </div>
      {archived.length > 0 && (
        <>
          <div className="note" style={{ marginBottom: 4 }}>Archived</div>
          <div className="sp-catalog">
            {archived.map((i) => (
              <span key={i.id} className="sp-chip" style={{ opacity: 0.7 }}>{i.name}<button className="sp-x" aria-label={`Restore ${i.name}`} title="Restore" onClick={() => toggle(i)}>↺</button></span>
            ))}
          </div>
        </>
      )}
      <div className="sp-compose" style={{ marginTop: 0 }}>
        <input className="sp-input" aria-label={`New ${title.toLowerCase().slice(0, -1)} name`} placeholder={`New ${title.toLowerCase().slice(0, -1)}`} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button className="sp-btn" disabled={busy || !name.trim()} onClick={add}>Add</button>
      </div>
    </div>
  );
}
