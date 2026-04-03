"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Loader2, Trophy, Users, Zap, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  addParticipant,
  removeParticipant,
  updateParticipantScores,
  deleteSprint,
} from "@/app/(app)/sprints/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

interface Column { id: string; name: string; }
interface Sprint {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  columns: { won: Column[]; deducted: Column[] };
}
interface Profile { id: string; full_name: string; avatar_url: string | null; job_title?: string | null; }
interface Participant {
  id: string;
  sprint_id: string;
  user_id: string;
  base_points: number;
  scores: Record<string, number>;
  project_allocations: Record<string, number>;
  profile: Profile;
}
interface Project { id: string; name: string; }

interface Props {
  sprint: Sprint;
  participants: Participant[];
  projects: Project[];
  orgUsers: Profile[];
}

function getInitials(n: string) { return n.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2); }
function formatDate(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

// Compute grand total for a participant
function grandTotal(p: Participant, wonCols: Column[], dedCols: Column[]) {
  const won = wonCols.reduce((s, c) => s + (p.scores[c.id] || 0), 0);
  const ded = dedCols.reduce((s, c) => s + (p.scores[c.id] || 0), 0);
  return p.base_points + won - ded;
}

// ── Component ─────────────────────────────────────────────────

export default function SprintDetailClient({ sprint, participants: initParticipants, projects, orgUsers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [participants, setParticipants] = useState<Participant[]>(initParticipants);
  const [showAddUser, setShowAddUser] = useState(false);
  const [tab, setTab] = useState<"grid" | "analytics">("analytics");
  const [savingId, setSavingId] = useState<string | null>(null);

  const wonCols = sprint.columns?.won ?? [];
  const dedCols = sprint.columns?.deducted ?? [];

  // ── Local Editing ──────────────────────────────────────────
  function setScore(userId: string, colId: string, value: number) {
    setParticipants(prev =>
      prev.map(p => p.user_id === userId ? { ...p, scores: { ...p.scores, [colId]: value } } : p)
    );
  }

  function setBase(userId: string, value: number) {
    setParticipants(prev =>
      prev.map(p => p.user_id === userId ? { ...p, base_points: value } : p)
    );
  }

  function setAllocation(userId: string, projectId: string, value: number) {
    setParticipants(prev =>
      prev.map(p => p.user_id === userId ? { ...p, project_allocations: { ...p.project_allocations, [projectId]: value } } : p)
    );
  }

  async function saveParticipant(p: Participant) {
    setSavingId(p.user_id);
    const res = await updateParticipantScores(sprint.id, p.user_id, p.scores, p.base_points, p.project_allocations);
    setSavingId(null);
    if ("error" in res && res.error) toast.error(res.error);
    else toast.success(`Saved ${p.profile.full_name}`);
  }

  // ── Add Participant ────────────────────────────────────────
  const existingIds = new Set(participants.map(p => p.user_id));
  const availableUsers = orgUsers.filter(u => !existingIds.has(u.id));

  async function handleAdd(userId: string) {
    const basePoints = 20;
    const res = await addParticipant(sprint.id, userId, basePoints);
    if ("error" in res && res.error) { toast.error(res.error); return; }
    const user = orgUsers.find(u => u.id === userId)!;
    setParticipants(prev => [...prev, {
      id: userId, sprint_id: sprint.id, user_id: userId,
      base_points: basePoints, scores: {}, project_allocations: {},
      profile: user,
    }]);
    setShowAddUser(false);
    toast.success(`Added ${user.full_name}`);
  }

  async function handleRemove(userId: string) {
    const res = await removeParticipant(sprint.id, userId);
    if ("error" in res && res.error) { toast.error(res.error); return; }
    setParticipants(prev => prev.filter(p => p.user_id !== userId));
    toast.success("Removed from sprint");
  }

  async function handleDeleteSprint() {
    if (!confirm(`Are you sure you want to delete the sprint "${sprint.name}"? This will delete all associated point data.`)) return;
    const res = await deleteSprint(sprint.id);
    if ("error" in res && res.error) toast.error(res.error);
    else {
      toast.success("Sprint deleted");
      startTransition(() => router.push("/sprints"));
    }
  }

  // ── Analytics ─────────────────────────────────────────────
  const ranked = useMemo(() =>
    [...participants]
      .map(p => ({ ...p, total: grandTotal(p, wonCols, dedCols) }))
      .sort((a, b) => b.total - a.total),
    [participants, wonCols, dedCols]
  );

  const winner = ranked[0];

  // Pie chart data per project (total % across participants)
  const projectTotals = useMemo(() => projects.map(proj => {
    const total = participants.reduce((s, p) => s + (p.project_allocations[proj.id] || 0), 0);
    return { ...proj, total };
  }).filter(p => p.total > 0), [participants, projects]);

  const PIE_COLORS = ["#7c3aed", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e", "#3b82f6", "#a855f7", "#84cc16"];

  const pieTotal = projectTotals.reduce((s, p) => s + p.total, 0);
  let cumAngle = 0;
  const slices = projectTotals.map((p, i) => {
    const pct = pieTotal > 0 ? p.total / pieTotal : 0;
    const start = cumAngle;
    cumAngle += pct * 360;
    return { ...p, pct, startAngle: start, endAngle: cumAngle, color: PIE_COLORS[i % PIE_COLORS.length] };
  });

  function polarToXY(angle: number, r: number) {
    const rad = (angle - 90) * (Math.PI / 180);
    return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
  }

  function describeSlice(start: number, end: number, r: number) {
    const s = polarToXY(start, r);
    const e = polarToXY(end, r);
    const large = end - start > 180 ? 1 : 0;
    // For single full slice, SVG arc can fail, so use 359.9
    if (end - start >= 360) {
      return `M 50 50 L 50 ${50 - r} A ${r} ${r} 0 1 1 49.99 ${50 - r} Z`;
    }
    return `M 50 50 L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
  }

  function renderPie(data: { name: string; val: number }[], size: number = 48) {
    const total = data.reduce((s, d) => s + d.val, 0);
    if (total === 0) return null;
    let cumAngle = 0;
    return (
      <svg viewBox="0 0 100 100" className={cn("flex-shrink-0", size === 48 ? "h-48 w-48" : "h-10 w-10")}>
        {data.map((d, i) => {
          const pct = d.val / total;
          const start = cumAngle;
          cumAngle += pct * 360;
          const color = PIE_COLORS[i % PIE_COLORS.length];
          return (
            <path
              key={i}
              d={describeSlice(start, cumAngle, 40)}
              fill={color}
            >
              <title>{d.name}: {Math.round(pct * 100)}%</title>
            </path>
          );
        })}
        <circle cx="50" cy="50" r={size === 48 ? 22 : 20} fill="white" />
      </svg>
    );
  }

  return (
    <div className="max-w-full px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => startTransition(() => router.push("/sprints"))}
          className="text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <Zap className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{sprint.name}</h1>
            <p className="text-sm text-slate-500">{formatDate(sprint.start_date)} – {formatDate(sprint.end_date)}</p>
          </div>
        </div>
        <div className="ml-auto">
          <Button
            variant="ghost"
            onClick={handleDeleteSprint}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 gap-2 h-9 px-3"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete Sprint</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 mb-6 max-w-xs">
        {(["analytics", "grid"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-colors",
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t === "analytics" ? "Analytics" : "Grid Tracker"}
          </button>
        ))}
      </div>

      {/* ── ANALYTICS VIEW ─────────────────────────────────── */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {/* Winner Card */}
          {winner && (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-bold uppercase tracking-widest text-amber-600">Sprint Leader</span>
              </div>
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 ring-4 ring-amber-200">
                  <AvatarFallback className="bg-amber-100 text-amber-700 text-lg font-bold">
                    {getInitials(winner.profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xl font-extrabold text-slate-900">{winner.profile.full_name}</p>
                  {winner.profile.job_title && <p className="text-sm text-slate-500">{winner.profile.job_title}</p>}
                  <p className="text-2xl font-extrabold text-amber-600 mt-1">{winner.total} pts</p>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Rankings */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">All Participants</h2>
            </div>
            {ranked.length === 0 ? (
              <p className="text-sm text-slate-400">No participants yet.</p>
            ) : (
              <div className="space-y-2">
                {ranked.map((p, i) => (
                  <div key={p.user_id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                    <div className={cn(
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-extrabold",
                      i === 0 ? "bg-amber-100 text-amber-600" : i === 1 ? "bg-slate-100 text-slate-500" : i === 2 ? "bg-orange-100 text-orange-500" : "bg-slate-50 text-slate-400"
                    )}>
                      {i === 0 ? <Trophy className="h-4 w-4" /> : i + 1}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={p.profile.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-bold">
                        {getInitials(p.profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.profile.full_name}</p>
                    </div>

                    {/* Individual Mini Pie */}
                    <div className="flex-shrink-0">
                      {renderPie(
                        projects.map(proj => ({ name: proj.name, val: p.project_allocations[proj.id] || 0 })).filter(d => d.val > 0),
                        10
                      )}
                    </div>

                    <div className="text-right">
                      <p className={cn("text-base font-extrabold", i === 0 ? "text-amber-600" : "text-violet-600")}>{p.total} pts</p>
                      <p className="text-[10px] text-slate-400">base: {p.base_points}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Project Allocation Pie Chart */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-5">
              <Target className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Project Allocation Overview</h2>
            </div>
            {slices.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Target className="h-10 w-10 text-slate-100 mb-2" />
                <p className="text-sm font-medium text-slate-400">No project allocations saved yet.</p>
                <p className="text-xs text-slate-400 mt-1">Assign percentages in the Grid Tracker to see the distribution.</p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-8">
                {renderPie(projectTotals.map(p => ({ name: p.name, val: p.total })), 48)}
                <div className="flex flex-col gap-2">
                  {slices.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-sm font-medium text-slate-700">{s.name}</span>
                      <span className="text-sm text-slate-400 ml-1">{Math.round(s.pct * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GRID TRACKER VIEW ─────────────────────────────── */}
      {tab === "grid" && (
        <div>
          {/* Add participant */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">{participants.length} Participants</h2>
            <Button
              size="sm"
              onClick={() => setShowAddUser(v => !v)}
              className="gap-1.5 text-xs h-8 bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Person
            </Button>
          </div>

          {/* Add user dropdown */}
          {showAddUser && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-md mb-4 max-h-60 overflow-y-auto">
              {availableUsers.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">All team members already added.</p>
              ) : (
                availableUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleAdd(u.id)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-violet-50 transition-colors"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={u.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px] font-bold bg-violet-100 text-violet-700">{getInitials(u.full_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{u.full_name}</p>
                      {u.job_title && <p className="text-xs text-slate-400">{u.job_title}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Scrollable grid */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="sticky left-0 z-20 bg-slate-100 px-4 py-3 text-left text-xs font-bold text-slate-600 min-w-[200px] border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    INN Resource
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-600 bg-slate-50">Base</th>
                  {wonCols.length > 0 && (
                    <th colSpan={wonCols.length} className="px-3 py-2 text-center text-xs font-bold text-green-700 bg-green-50 border-l border-slate-200">
                      Points Won
                    </th>
                  )}
                  {dedCols.length > 0 && (
                    <th colSpan={dedCols.length} className="px-3 py-2 text-center text-xs font-bold text-red-700 bg-red-50 border-l border-slate-200">
                      Points Deducted
                    </th>
                  )}
                  {projects.length > 0 && (
                    <th colSpan={projects.length} className="px-3 py-2 text-center text-xs font-bold text-violet-700 bg-violet-50 border-l border-slate-200">
                      Project Allocation %
                    </th>
                  )}
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-800 bg-yellow-50 border-l border-slate-200">Grand Total</th>
                  <th className="px-3 py-3 bg-slate-50"></th>
                </tr>
                <tr className="bg-white border-b border-slate-100">
                  <th className="sticky left-0 z-20 bg-white px-4 py-2 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"></th>
                  <th className="px-2 py-1 text-center text-[10px] text-slate-400 font-medium">points</th>
                  {wonCols.map(c => (
                    <th key={c.id} className="px-2 py-1 text-center text-[10px] text-green-600 font-medium bg-green-50/60 border-l border-green-100">
                      {c.name}
                    </th>
                  ))}
                  {dedCols.map(c => (
                    <th key={c.id} className="px-2 py-1 text-center text-[10px] text-red-500 font-medium bg-red-50/60 border-l border-red-100">
                      {c.name}
                    </th>
                  ))}
                  {projects.map(p => (
                    <th key={p.id} className="px-2 py-1 text-center text-[10px] text-violet-600 font-medium bg-violet-50/60 border-l border-violet-100">
                      {p.name}
                    </th>
                  ))}
                  <th className="px-2 py-1 bg-yellow-50/60 border-l border-yellow-100"></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {participants.length === 0 && (
                  <tr>
                    <td colSpan={99} className="px-4 py-8 text-center text-sm text-slate-400">
                      Add people to the sprint to get started.
                    </td>
                  </tr>
                )}
                {participants.map((p, rowIdx) => {
                  const total = grandTotal(p, wonCols, dedCols);
                  const isSaving = savingId === p.user_id;
                  const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50";
                  return (
                    <tr key={p.user_id} className={cn("border-b border-slate-100 hover:bg-slate-100/50 transition-colors", rowBg)}>
                      {/* Name */}
                      <td className={cn("sticky left-0 z-10 px-4 py-2 font-medium text-slate-800 whitespace-nowrap border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]", rowBg)}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 flex-shrink-0">
                            <AvatarImage src={p.profile.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[9px] font-bold bg-violet-100 text-violet-700">{getInitials(p.profile.full_name)}</AvatarFallback>
                          </Avatar>
                          {p.profile.full_name}
                        </div>
                      </td>

                      {/* Base Points */}
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number"
                          value={p.base_points}
                          onChange={e => setBase(p.user_id, Number(e.target.value))}
                          className="w-14 rounded-lg border border-slate-200 text-center text-sm py-1 outline-none focus:border-violet-400"
                        />
                      </td>

                      {/* Won cols */}
                      {wonCols.map(c => (
                        <td key={c.id} className="px-2 py-2 text-center bg-green-50/30 border-l border-green-100">
                          <input
                            type="number"
                            min={0}
                            value={p.scores[c.id] || ""}
                            onChange={e => setScore(p.user_id, c.id, Number(e.target.value))}
                            placeholder="—"
                            className="w-14 rounded-lg border border-green-200 text-center text-sm py-1 outline-none focus:border-green-400 bg-white"
                          />
                        </td>
                      ))}

                      {/* Deducted cols */}
                      {dedCols.map(c => (
                        <td key={c.id} className="px-2 py-2 text-center bg-red-50/30 border-l border-red-100">
                          <input
                            type="number"
                            min={0}
                            value={p.scores[c.id] || ""}
                            onChange={e => setScore(p.user_id, c.id, Number(e.target.value))}
                            placeholder="—"
                            className="w-14 rounded-lg border border-red-200 text-center text-sm py-1 outline-none focus:border-red-400 bg-white"
                          />
                        </td>
                      ))}

                      {/* Project allocations */}
                      {projects.map(proj => (
                        <td key={proj.id} className="px-2 py-2 text-center bg-violet-50/30 border-l border-violet-100">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={p.project_allocations[proj.id] || ""}
                            onChange={e => setAllocation(p.user_id, proj.id, Number(e.target.value))}
                            placeholder="—"
                            className="w-14 rounded-lg border border-violet-200 text-center text-sm py-1 outline-none focus:border-violet-400 bg-white"
                          />
                        </td>
                      ))}

                      {/* Grand total */}
                      <td className="px-3 py-2 text-center font-extrabold text-slate-900 bg-yellow-50/50 border-l border-yellow-100">
                        {total}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button
                            size="sm"
                            onClick={() => saveParticipant(p)}
                            disabled={isSaving}
                            className="h-7 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1"
                          >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                          </Button>
                          <button
                            onClick={() => handleRemove(p.user_id)}
                            className="text-slate-300 hover:text-red-400 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
