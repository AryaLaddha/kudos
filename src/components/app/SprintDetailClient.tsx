"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Loader2, Trophy, Users, Zap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  addParticipant,
  removeParticipant,
  updateParticipantScores,
  deleteSprint,
  updateSprintStatus,
  updateAllParticipants,
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
  status: "active" | "completed";
  columns: { won: Column[]; deducted: Column[] };
}
interface Profile { id: string; full_name: string; avatar_url: string | null; job_title?: string | null; }
interface Participant {
  id: string;
  sprint_id: string;
  user_id: string;
  base_points: number;
  scores: Record<string, number>;
  profile: Profile;
}

interface Props {
  sprint: Sprint;
  participants: Participant[];
  orgUsers: Profile[];
}

function getInitials(n: string) { return n.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2); }
function formatDate(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

// Compute grand total for a participant
function grandTotal(p: Participant) {
  return p.base_points + Object.values(p.scores).reduce((s, v) => s + (v || 0), 0);
}

// ── Component ─────────────────────────────────────────────────

export default function SprintDetailClient({ sprint, participants: initParticipants, orgUsers }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [participants, setParticipants] = useState<Participant[]>(initParticipants);
  const [showAddUser, setShowAddUser] = useState(false);
  const [tab, setTab] = useState<"grid" | "analytics">("analytics");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());

  function toggleCard(userId: string) {
    setCollapsedCards(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

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

  async function saveParticipant(p: Participant) {
    setSavingId(p.user_id);
    const res = await updateParticipantScores(sprint.id, p.user_id, p.scores, p.base_points);
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
      base_points: basePoints, scores: {},
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
      .map(p => ({ ...p, total: grandTotal(p) }))
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.profile.full_name.localeCompare(b.profile.full_name);
      }),
    [participants]
  );

  async function handleToggleStatus() {
    const next = sprint.status === "completed" ? "active" : "completed";
    const res = await updateSprintStatus(sprint.id, next);
    if ("error" in res && res.error) toast.error(res.error);
    else toast.success(`Sprint marked as ${next}`);
  }

  async function handleSaveAll() {
    setSavingId("ALL");
    const res = await updateAllParticipants(sprint.id, participants.map(p => ({
      user_id: p.user_id,
      scores: p.scores,
      base_points: p.base_points,
    })));
    setSavingId(null);
    if ("error" in res && res.error) toast.error(res.error);
    else toast.success("All changes saved!");
  }

  const winner = ranked[0];

  return (
    <div className="max-w-full px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => startTransition(() => router.push("/sprints"))}
          className="text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100">
            <Zap className="h-5 w-5 text-violet-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">{sprint.name}</h1>
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0",
                sprint.status === "completed" ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700"
              )}>
                {sprint.status === "completed" ? "Completed" : "In Progress"}
              </div>
            </div>
            <p className="text-sm text-slate-500 truncate">{formatDate(sprint.start_date)} – {formatDate(sprint.end_date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            className="h-9 px-3 gap-2"
          >
            {sprint.status === "completed" ? <Plus className="h-4 w-4" /> : <X className="h-4 w-4" />}
            <span className="sm:hidden">{sprint.status === "completed" ? "Re-open" : "Complete"}</span>
            <span className="hidden sm:inline">{sprint.status === "completed" ? "Re-open Sprint" : "Complete Sprint"}</span>
          </Button>
          <Button
            variant="ghost"
            onClick={handleDeleteSprint}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 gap-2 h-9 px-3"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
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
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={p.profile.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-bold">
                        {getInitials(p.profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.profile.full_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn("text-base font-extrabold whitespace-nowrap", i === 0 ? "text-amber-600" : "text-violet-600")}>{p.total} pts</p>
                      <p className="text-[10px] text-slate-400 whitespace-nowrap">base: {p.base_points}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GRID TRACKER VIEW ─────────────────────────────── */}
      {tab === "grid" && (
        <div>
          {/* Add participant */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">{participants.length} Participants</h2>
              <Button
                size="sm"
                onClick={handleSaveAll}
                disabled={savingId === "ALL"}
                className="gap-1.5 text-xs h-8 bg-green-600 hover:bg-green-700 text-white font-bold"
              >
                {savingId === "ALL" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Save All Changes
              </Button>
            </div>
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

          {/* ── Mobile card view (sm and below) ── */}
          <div className="sm:hidden space-y-3">
            {participants.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">Add people to the sprint to get started.</p>
            )}
            {participants.map(p => {
              const total = grandTotal(p);
              const isSaving = savingId === p.user_id;
              return (
                <div key={p.user_id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Accordion header */}
                  <button
                    onClick={() => toggleCard(p.user_id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={p.profile.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[9px] font-bold bg-violet-100 text-violet-700">{getInitials(p.profile.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{p.profile.full_name}</p>
                        <p className="text-xs font-bold text-violet-600">Total: {total} pts</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); handleRemove(p.user_id); }}
                        className="text-slate-300 hover:text-red-400 transition-colors p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <ChevronDown className={cn(
                        "h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0",
                        collapsedCards.has(p.user_id) ? "-rotate-90" : "rotate-0"
                      )} />
                    </div>
                  </button>

                  {/* Collapsible body */}
                  {!collapsedCards.has(p.user_id) && (
                    <>
                      <div className="p-4 grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Base Pts</label>
                          <input
                            type="number"
                            value={p.base_points}
                            onChange={e => setBase(p.user_id, Number(e.target.value))}
                            onWheel={e => e.currentTarget.blur()}
                            className="w-full rounded-lg border border-slate-200 text-center text-sm py-1.5 outline-none focus:border-violet-400"
                          />
                        </div>
                        {wonCols.map(c => (
                          <div key={c.id}>
                            <label className="text-[10px] font-bold text-green-600 uppercase tracking-wide block mb-1">+ {c.name}</label>
                            <input
                              type="number"
                              min={0}
                              value={p.scores[c.id] || ""}
                              onChange={e => setScore(p.user_id, c.id, Number(e.target.value))}
                              onWheel={e => e.currentTarget.blur()}
                              placeholder="—"
                              className="w-full rounded-lg border border-green-200 text-center text-sm py-1.5 outline-none focus:border-green-400 bg-white"
                            />
                          </div>
                        ))}
                        {dedCols.map(c => (
                          <div key={c.id}>
                            <label className="text-[10px] font-bold text-red-500 uppercase tracking-wide block mb-1">− {c.name}</label>
                            <input
                              type="number"
                              max={0}
                              value={p.scores[c.id] || ""}
                              onChange={e => setScore(p.user_id, c.id, Number(e.target.value))}
                              onWheel={e => e.currentTarget.blur()}
                              placeholder="—"
                              className="w-full rounded-lg border border-red-200 text-center text-sm py-1.5 outline-none focus:border-red-400 bg-white"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-end px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                        <Button
                          size="sm"
                          onClick={() => saveParticipant(p)}
                          disabled={isSaving}
                          className="h-7 px-4 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1"
                        >
                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Desktop scrollable table (hidden on mobile) ── */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
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
                  const total = grandTotal(p);
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
                          onWheel={e => e.currentTarget.blur()}
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
                            onWheel={e => e.currentTarget.blur()}
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
                            max={0}
                            value={p.scores[c.id] || ""}
                            onChange={e => setScore(p.user_id, c.id, Number(e.target.value))}
                            onWheel={e => e.currentTarget.blur()}
                            placeholder="—"
                            className="w-14 rounded-lg border border-red-200 text-center text-sm py-1 outline-none focus:border-red-400 bg-white"
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
