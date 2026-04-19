"use client";

import { useMemo, useState } from "react";
import {
  Trophy,
  BarChart3,
  ListOrdered,
  Zap,
  Target,
  Briefcase,
  ShieldAlert,
  Activity,
  HelpCircle,
  Users,
  Coins,
  Medal,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

interface Sprint {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "active" | "completed";
}
interface Project { id: string; name: string; is_archived?: boolean; }
interface Profile { id: string; full_name: string; avatar_url: string | null; job_title?: string | null; }
interface Participant {
  sprint_id: string;
  user_id: string;
  base_points: number;
  scores: Record<string, number>;
  project_allocations: Record<string, number>;
  profile: Profile;
}
interface UserGoal {
  id: string;
  user_id: string;
  goal_id: string;
  status: "aim" | "achieved";
  description: string;
  created_at: string;
}
interface GoalDefinition {
  id: string;
  title: string;
  points: number;
  category: string;
}
interface Recognition {
  receiver_id: string;
  receiver_ids: string[] | null;
  points: number;
  created_at: string;
}

interface Props {
  sprints: Sprint[];
  projects: Project[];
  participants: Participant[];
  orgUsers: Profile[];
  userGoals: UserGoal[];
  goalDefinitions: GoalDefinition[];
  recognitions: Recognition[];
}

function getInitials(n: string) { return n.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2); }

// ── Tooltip helper ────────────────────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative group inline-flex items-center">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-medium text-white leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </span>
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function AdminDashboardClient({
  sprints,
  projects,
  participants,
  orgUsers,
  userGoals,
  goalDefinitions,
  recognitions,
}: Props) {
  // Sprints are ordered start_date DESC — index 0 is the latest
  const latestSprintId = sprints[0]?.id ?? "all_time";

  const [tab, setTab] = useState<"points" | "projects" | "quality" | "utilization">("points");
  const [subTab, setSubTab] = useState<"overall" | "recognition" | "sprint" | "goals">("overall");
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");

  const [overallFilter, setOverallFilter] = useState<{ type: "all" | "month"; monthValue?: string }>({ type: "all" });
  const [goalsFilter, setGoalsFilter] = useState<{ type: "all" | "month"; monthValue?: string }>({ type: "all" });
  const [recognitionFilter, setRecognitionFilter] = useState<{ type: "all" | "month"; monthValue?: string }>({ type: "all" });
  const [sprintFilter, setSprintFilter] = useState<string>("all_time");
  const [qualitySprintFilter, setQualitySprintFilter] = useState<string>(latestSprintId);
  const [healthSprintFilter, setHealthSprintFilter] = useState<string>(latestSprintId);
  const [healthPersonFilter, setHealthPersonFilter] = useState<string>("all");

  const CATEGORY_COLORS: Record<string, string> = {
    "Learning & Certification": "bg-violet-500",
    "Sprint Contribution": "bg-emerald-500",
    "Productivity & Efficiency": "bg-amber-500",
    "Practice Growth": "bg-blue-500",
    "Collaboration & Quality": "bg-rose-500",
  };

  // ── 1. Recognition Leaderboard ──
  const recognitionRanking = useMemo(() => {
    let filtered = recognitions;
    if (recognitionFilter.type === "month" && recognitionFilter.monthValue) {
      filtered = recognitions.filter(r => r.created_at.startsWith(recognitionFilter.monthValue!));
    }
    const stats: Record<string, { profile: Profile; total: number }> = {};
    const userMap: Record<string, Profile> = {};
    orgUsers.forEach(u => { userMap[u.id] = u; });
    filtered.forEach(r => {
      const receivers = [...(r.receiver_id ? [r.receiver_id] : []), ...(r.receiver_ids ?? [])];
      Array.from(new Set(receivers)).forEach(uid => {
        const profile = userMap[uid];
        if (!profile) return;
        if (!stats[uid]) stats[uid] = { profile, total: 0 };
        stats[uid].total += r.points;
      });
    });
    return Object.values(stats).filter(s => s.total > 0).sort((a, b) => b.total - a.total);
  }, [recognitions, recognitionFilter, orgUsers]);

  // ── 2. Sprint Leaderboard ──
  const sprintRanking = useMemo(() => {
    let filtered = participants;
    if (sprintFilter !== "all_time") filtered = participants.filter(p => p.sprint_id === sprintFilter);
    const stats: Record<string, { profile: Profile; total: number }> = {};
    filtered.forEach(p => {
      if (!p.profile) return;
      const scores = p.scores ?? {};
      if (!stats[p.user_id]) stats[p.user_id] = { profile: p.profile, total: 0 };
      const net = p.base_points + Object.values(scores).reduce((s, v) => s + (v || 0), 0);
      if (sprintFilter === "all_time") stats[p.user_id].total += net;
      else stats[p.user_id].total = net;
    });
    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [participants, sprintFilter]);

  // ── 3. Goals Leaderboard & Heatmap ──
  const { goalsRanking, goalList, goalCategoryStats, totalAchievedGoals } = useMemo(() => {
    let filteredGoals = userGoals.filter(ug => ug.status === "achieved");
    
    if (goalsFilter.type === "month" && goalsFilter.monthValue) {
      filteredGoals = filteredGoals.filter(ug => ug.created_at.startsWith(goalsFilter.monthValue!));
    }

    const stats: Record<string, { profile: Profile; total: number; count: number }> = {};
    const catStats: Record<string, number> = {};
    
    const list = filteredGoals.map(ug => {
      const user = orgUsers.find(u => u.id === ug.user_id);
      const goal = goalDefinitions.find(g => g.id === ug.goal_id);
      
      if (user && goal) {
        if (!stats[ug.user_id]) stats[ug.user_id] = { profile: user, total: 0, count: 0 };
        stats[ug.user_id].total += goal.points;
        stats[ug.user_id].count += 1;
        catStats[goal.category] = (catStats[goal.category] || 0) + 1;
      }
      return { ...ug, user, goal };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalAchieved = filteredGoals.length;

    return {
      goalsRanking: Object.values(stats).sort((a, b) => b.total - a.total),
      goalList: list,
      goalCategoryStats: Object.entries(catStats)
        .map(([name, count]) => ({ name, count, pct: totalAchieved ? (count / totalAchieved) * 100 : 0 }))
        .sort((a, b) => b.count - a.count),
      totalAchievedGoals: totalAchieved
    };
  }, [userGoals, orgUsers, goalDefinitions, goalsFilter]);

  // ── 4. Overall Master Leaderboard ──
  const overallRanking = useMemo(() => {
    const stats: Record<string, { profile: Profile; total: number; recognitionPoints: number; sprintPoints: number; goalPoints: number }> = {};
    
    orgUsers.forEach(u => {
      stats[u.id] = { profile: u, total: 0, recognitionPoints: 0, sprintPoints: 0, goalPoints: 0 };
    });

    // 1. Recognition
    let filteredRec = recognitions;
    if (overallFilter.type === "month" && overallFilter.monthValue) {
      filteredRec = recognitions.filter(r => r.created_at.startsWith(overallFilter.monthValue!));
    }
    filteredRec.forEach(r => {
      const receivers = [...(r.receiver_id ? [r.receiver_id] : []), ...(r.receiver_ids ?? [])];
      Array.from(new Set(receivers)).forEach(uid => {
        if (stats[uid]) {
          stats[uid].recognitionPoints += r.points;
          stats[uid].total += r.points;
        }
      });
    });

    // 2. Sprint (If month filter: include sprints ENDING in that month, else all sprints)
    let validSprints = sprints;
    if (overallFilter.type === "month" && overallFilter.monthValue) {
      validSprints = sprints.filter(s => s.end_date?.startsWith(overallFilter.monthValue!) && s.status === "completed");
    }
    const validSprintIds = new Set(validSprints.map(s => s.id));
    
    participants.filter(p => validSprintIds.has(p.sprint_id)).forEach(p => {
       if (stats[p.user_id]) {
         const scores = p.scores ?? {};
         const net = p.base_points + Object.values(scores).reduce((s, v) => s + (v || 0), 0);
         stats[p.user_id].sprintPoints += net;
         stats[p.user_id].total += net;
       }
    });

    // 3. Goals
    let filteredGo = userGoals.filter(ug => ug.status === "achieved");
    if (overallFilter.type === "month" && overallFilter.monthValue) {
      filteredGo = filteredGo.filter(ug => ug.created_at.startsWith(overallFilter.monthValue!));
    }
    filteredGo.forEach(ug => {
      if (stats[ug.user_id]) {
        const goal = goalDefinitions.find(g => g.id === ug.goal_id);
        if (goal) {
          stats[ug.user_id].goalPoints += goal.points;
          stats[ug.user_id].total += goal.points;
        }
      }
    });

    return Object.values(stats)
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total)
      .map(s => ({
         ...s,
         subtext: `Rec: ${s.recognitionPoints} | Spr: ${s.sprintPoints} | Gls: ${s.goalPoints}`
      }));
  }, [recognitions, participants, sprints, userGoals, orgUsers, goalDefinitions, overallFilter]);

  // ── 4. Project Efficiency (ROI) — all sprints ──
  const projectEfficiency = useMemo(() => {
    const stats: Record<string, { id: string; name: string; totalEffort: number; totalRecognition: number }> = {};
    projects.forEach(p => { 
      stats[p.id] = { 
        id: p.id, 
        name: p.is_archived ? `${p.name} (Archived)` : p.name, 
        totalEffort: 0, 
        totalRecognition: 0 
      }; 
    });
    participants.forEach(p => {
      if (!p.profile) return;
      const scores = p.scores ?? {};
      const allocs = p.project_allocations ?? {};
      const rec = scores["recognition"] || 0;
      const totalAlloc = Object.values(allocs).reduce((s, v) => s + v, 0);
      Object.entries(allocs).forEach(([projId, val]) => {
        if (!stats[projId]) return;
        stats[projId].totalEffort += val;
        if (totalAlloc > 0) stats[projId].totalRecognition += (val / totalAlloc) * rec;
      });
    });
    const totalRec = Object.values(stats).reduce((s, v) => s + v.totalRecognition, 0);
    const totalEffort = Object.values(stats).reduce((s, v) => s + v.totalEffort, 0);
    return Object.values(stats)
      .map(p => ({
        ...p,
        effortPct: totalEffort > 0 ? (p.totalEffort / totalEffort) * 100 : 0,
        recPct: totalRec > 0 ? (p.totalRecognition / totalRec) * 100 : 0,
      }))
      .map(p => ({ ...p, ratio: p.effortPct > 0 ? p.recPct / p.effortPct : 0 }))
      .sort((a, b) => b.ratio - a.ratio);
  }, [projects, participants]);

  // ── 5. Quality Control — filtered by sprint ──
  const qualityStats = useMemo(() => {
    const filtered = qualitySprintFilter === "all_time"
      ? participants
      : participants.filter(p => p.sprint_id === qualitySprintFilter);

    const itemTotals: Record<string, number> = {};
    const userStats: Record<string, { profile: Profile; bugs: number }> = {};

    filtered.forEach(p => {
      if (!p.profile) return;
      const scores = p.scores ?? {};
      Object.entries(scores).forEach(([key, val]) => {
        if (val < 0) {
          const abs = Math.abs(val);
          itemTotals[key] = (itemTotals[key] || 0) + abs;
          if (!userStats[p.user_id]) userStats[p.user_id] = { profile: p.profile, bugs: 0 };
          if (key === "bugs") userStats[p.user_id].bugs += abs;
        }
      });
    });

    return {
      ranking: Object.values(userStats).filter(u => u.bugs > 0).sort((a, b) => b.bugs - a.bugs),
      issues: Object.entries(itemTotals).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    };
  }, [participants, qualitySprintFilter]);

  // ── 6. Resource Health — filtered by sprint ──
  const resourceHealth = useMemo(() => {
    const sprintParticipants = healthSprintFilter === "all_time"
      ? null // means: use latest sprint per user (original behavior)
      : participants.filter(p => p.sprint_id === healthSprintFilter);

    return orgUsers.map(user => {
      let alloc = 0;
      if (sprintParticipants) {
        const p = sprintParticipants.find(p => p.user_id === user.id);
        alloc = Object.values(p?.project_allocations ?? {}).reduce((s, v) => s + v, 0);
      } else {
        // all_time: use each user's latest sprint
        const sorted = participants
          .filter(p => p.user_id === user.id)
          .sort((a, b) => {
            const sA = sprints.find(s => s.id === a.sprint_id);
            const sB = sprints.find(s => s.id === b.sprint_id);
            return new Date(sB?.start_date || "").getTime() - new Date(sA?.start_date || "").getTime();
          });
        alloc = Object.values(sorted[0]?.project_allocations ?? {}).reduce((s, v) => s + v, 0);
      }
      return {
        user,
        alloc,
        status: alloc > 100 ? "overloaded" : alloc < 50 ? "underutilized" : "balanced" as "overloaded" | "balanced" | "underutilized",
      };
    }).sort((a, b) => b.alloc - a.alloc);
  }, [orgUsers, participants, sprints, healthSprintFilter]);

  // ── 7. Health trend — per-person across all sprints (for graph) ──
  const healthTrendData = useMemo(() => {
    // Sprints ordered DESC — reverse for chronological chart
    const chronological = [...sprints].reverse();

    if (healthPersonFilter !== "all") {
      // Single person: their alloc % in each sprint
      return chronological.map(sprint => {
        const p = participants.find(p => p.sprint_id === sprint.id && p.user_id === healthPersonFilter);
        const alloc = Object.values(p?.project_allocations ?? {}).reduce((s, v) => s + v, 0);
        const status = alloc > 100 ? "overloaded" : alloc < 50 ? "underutilized" : "balanced";
        return { sprintName: sprint.name, alloc, status };
      });
    }

    // Team overview: count per status per sprint
    return chronological.map(sprint => {
      const sprintPs = participants.filter(p => p.sprint_id === sprint.id);
      const counts = { overloaded: 0, balanced: 0, underutilized: 0 };
      orgUsers.forEach(user => {
        const p = sprintPs.find(p => p.user_id === user.id);
        const alloc = Object.values(p?.project_allocations ?? {}).reduce((s, v) => s + v, 0);
        if (alloc > 100) counts.overloaded++;
        else if (alloc < 50) counts.underutilized++;
        else counts.balanced++;
      });
      return { sprintName: sprint.name, counts, total: orgUsers.length };
    });
  }, [sprints, participants, orgUsers, healthPersonFilter]);

  // ── Helpers ──
  const overallMonthOptions = useMemo(() => {
    const months = new Set<string>();
    recognitions.forEach(r => r.created_at && months.add(r.created_at.substring(0, 7)));
    sprints.forEach(s => s.end_date && months.add(s.end_date.substring(0, 7)));
    userGoals.forEach(ug => ug.created_at && months.add(ug.created_at.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [recognitions, sprints, userGoals]);

  const selectClass = "bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 cursor-pointer";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-32">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Insights</h1>
          <p className="text-slate-500 mt-1 font-medium italic">Strategic reporting and team health monitoring</p>
        </div>
        <div className="overflow-x-auto w-full md:w-auto">
          <div className="flex w-max p-1 bg-slate-100/80 rounded-2xl">
            {[
              { id: "points",      label: "Points",      icon: Coins },
              { id: "projects",    label: "ROI",         icon: Briefcase },
              { id: "quality",     label: "Quality",     icon: ShieldAlert },
              { id: "utilization", label: "Health",      icon: Activity },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id as typeof tab); setViewMode("list"); }}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2 transition-all whitespace-nowrap",
                  tab === t.id ? "bg-white text-violet-600 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

        {tab === "points" && (
          <div className="overflow-x-auto">
            <div className="flex w-max items-center gap-2 p-1 bg-slate-50/50 rounded-xl">
              {[
                { id: "overall",     label: "Overall",     icon: Medal },
                { id: "recognition", label: "Recognition", icon: Zap },
                { id: "sprint",      label: "Sprints",     icon: Trophy },
                { id: "goals",       label: "Goals",       icon: Target },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => { setSubTab(st.id as typeof subTab); setViewMode("list"); }}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all",
                    subTab === st.id ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100" : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  <st.icon className="h-3.5 w-3.5" />
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        )}


      {/* Filters row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {tab === "points" && subTab === "recognition" && (
            <select className={selectClass}
              value={recognitionFilter.type === "all" ? "all" : recognitionFilter.monthValue}
              onChange={e => e.target.value === "all"
                ? setRecognitionFilter({ type: "all" })
                : setRecognitionFilter({ type: "month", monthValue: e.target.value })}>
              <option value="all">All Time History</option>
              {overallMonthOptions.map(m => (
                <option key={m} value={m}>{new Date(m + "-01").toLocaleString("en-US", { month: "long", year: "numeric" })}</option>
              ))}
            </select>
          )}

          {tab === "points" && subTab === "sprint" && (
            <select className={selectClass} value={sprintFilter} onChange={e => setSprintFilter(e.target.value)}>
              <option value="all_time">All Time Points</option>
              {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          {tab === "points" && subTab === "goals" && (
            <select className={selectClass}
              value={goalsFilter.type === "all" ? "all" : goalsFilter.monthValue}
              onChange={e => e.target.value === "all"
                ? setGoalsFilter({ type: "all" })
                : setGoalsFilter({ type: "month", monthValue: e.target.value })}>
              <option value="all">All Time Goals</option>
              {overallMonthOptions.map(m => (
                <option key={m} value={m}>{new Date(m + "-01").toLocaleString("en-US", { month: "long", year: "numeric" })}</option>
              ))}
            </select>
          )}

          {tab === "points" && subTab === "overall" && (
            <select className={selectClass}
              value={overallFilter.type === "all" ? "all" : overallFilter.monthValue}
              onChange={e => e.target.value === "all"
                ? setOverallFilter({ type: "all" })
                : setOverallFilter({ type: "month", monthValue: e.target.value })}>
              <option value="all">All Time Overall</option>
              {overallMonthOptions.map(m => (
                <option key={m} value={m}>{new Date(m + "-01").toLocaleString("en-US", { month: "long", year: "numeric" })}</option>
              ))}
            </select>
          )}

          {tab === "quality" && (
            <select className={selectClass} value={qualitySprintFilter} onChange={e => setQualitySprintFilter(e.target.value)}>
              <option value="all_time">All Sprints</option>
              {sprints.map(s => <option key={s.id} value={s.id}>{s.name}{s.id === latestSprintId ? " (latest)" : ""}</option>)}
            </select>
          )}

          {tab === "utilization" && (
            <div className="flex flex-wrap items-center gap-3">
              <select className={selectClass} value={healthSprintFilter} onChange={e => { setHealthSprintFilter(e.target.value); setHealthPersonFilter("all"); }}>
                <option value="all_time">Latest Per Person</option>
                {sprints.map(s => <option key={s.id} value={s.id}>{s.name}{s.id === latestSprintId ? " (latest)" : ""}</option>)}
              </select>
              <select className={selectClass} value={healthPersonFilter} onChange={e => setHealthPersonFilter(e.target.value)}>
                <option value="all">All Team Members</option>
                {orgUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
          )}

          {tab === "projects" && (
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2">
              <Activity className="h-3 w-3" /> All-time portfolio view
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <p className="text-xs font-medium text-slate-400 italic max-w-xs leading-tight">
            {tab === "points" && subTab === "overall"      && "Total points amassed through Goals, Sprints, and Recognition combined."}
            {tab === "points" && subTab === "recognition"  && "Track team recognition points and extra performance bonuses across any time period."}
            {tab === "points" && subTab === "sprint"       && "Cumulative performance audit: Base points plus net wins and deductions per sprint."}
            {tab === "points" && subTab === "goals"        && "Achievement leaderboard: Ranking professionals by goal points earned."}
            {tab === "projects"     && "Project efficiency index: Comparing team effort (allocation) vs. actual recognised results."}
            {tab === "quality"      && "Systemic issue monitor: Tracking bugs, absences, and communication audit trends."}
            {tab === "utilization"  && "Resource utilisation audit: Team workload and burnout risk across sprints."}
          </p>
          {(tab === "points" || tab === "quality") && (
            <div className="flex p-0.5 bg-slate-100/60 rounded-lg">
              <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-md transition-all", viewMode === "list" ? "bg-white text-violet-600 shadow-sm" : "text-slate-400")}><ListOrdered className="h-4 w-4" /></button>
              <button onClick={() => setViewMode("graph")} className={cn("p-1.5 rounded-md transition-all", viewMode === "graph" ? "bg-white text-violet-600 shadow-sm" : "text-slate-400")}><BarChart3 className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="space-y-6">

        {/* POINTS HUB CONTENT */}
        {tab === "points" && (
          <div className="space-y-6">
            {subTab === "overall" && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 sm:p-10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 mb-1">
                      {overallFilter.type === "all" ? "All Time Total Points" : `Total Points for ${new Date(overallFilter.monthValue! + "-01").toLocaleString("en-US", { month: "long", year: "numeric" })}`}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">Combined sum of Recognition, Sprint Performance, and Achieved Goals.</p>
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-indigo-600 bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50">
                    {overallRanking.reduce((sum, r) => sum + r.total, 0).toLocaleString()}
                    <span className="text-lg text-slate-400 ml-2">pts</span>
                  </div>
                </div>
                {viewMode === "list"
                  ? <RankingList data={overallRanking} unit="pts" />
                  : <RankingGraph data={overallRanking} unit="pts" />
                }
              </div>
            )}

            {subTab === "recognition" && (viewMode === "list"
              ? <RankingList data={recognitionRanking} subtext="kudos received" unit="pts" />
              : <RankingGraph data={recognitionRanking} unit="pts" />
            )}

            {subTab === "sprint" && (viewMode === "list"
              ? <RankingList data={sprintRanking} subtext="net performance" unit="pts" />
              : <RankingGraph data={sprintRanking} unit="pts" />
            )}

            {subTab === "goals" && (
              <div className="space-y-10">
                {viewMode === "list" 
                  ? <RankingList data={goalsRanking.map(r => ({ profile: r.profile, total: r.total }))} subtext="goal achievement points" unit="pts" />
                  : <RankingGraph data={goalsRanking.map(r => ({ profile: r.profile, total: r.total }))} unit="pts" />
                }
                
                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-sm">
                  <h3 className="text-xl font-black text-slate-900 mb-8">Practice Focus Heatmap</h3>
                  <div className="flex flex-col md:flex-row gap-10 items-center">
                    <div className="flex-1 w-full space-y-5">
                      {goalCategoryStats.length === 0 ? (
                        <div className="text-sm text-slate-400 italic">No goals completed in this period.</div>
                      ) : (
                        goalCategoryStats.map(cat => (
                          <div key={cat.name} className="space-y-2">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                              <span>{cat.name}</span>
                              <span className="text-slate-900">{cat.count} logs</span>
                            </div>
                            <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden">
                              <div style={{ width: `${cat.pct}%` }} className={cn("h-full transition-all duration-1000", CATEGORY_COLORS[cat.name] || "bg-slate-300")} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="w-full md:w-64 aspect-square rounded-full border-[16px] border-slate-50 flex items-center justify-center relative">
                      <div className="text-center absolute">
                        <p className="text-4xl font-black text-slate-900">{totalAchievedGoals}</p>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Total logs</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  {goalList.slice(0, 10).map(ug => (
                    <div key={ug.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center gap-6 text-left">
                      <Avatar className="h-12 w-12"><AvatarImage src={ug.user?.avatar_url || undefined} /><AvatarFallback className="bg-violet-100 text-violet-700 font-bold">{getInitials(ug.user?.full_name || "?")}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black text-slate-900 truncate">{ug.user?.full_name}</h4>
                        <p className="text-xs text-slate-500 font-bold truncate mt-0.5">{ug.goal?.title}</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Logged</p>
                        <p className="text-sm font-black text-slate-700 mt-1">{new Date(ug.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ROI */}
        {tab === "projects" && (
          projectEfficiency.length === 0
            ? <div className="text-center py-20 text-slate-300 italic border border-dashed border-slate-200 rounded-3xl">No projects yet — create projects in the Sprints page and assign allocations to participants.</div>
            : <div className="grid gap-6">
                {projectEfficiency.map(p => (
                  <div key={p.id} className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                    <div className="flex justify-between items-start gap-4 mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-50 rounded-xl"><Briefcase className="h-5 w-5 text-violet-600" /></div>
                        <div>
                          <h3 className="text-xl font-black text-slate-900 leading-none">{p.name}</h3>
                          <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">ROI Index: <span className="text-violet-600">{p.ratio.toFixed(2)}x</span></p>
                        </div>
                      </div>
                      {p.ratio > 1.25
                        ? <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-inset ring-emerald-100">Super Impact</span>
                        : p.ratio < 0.75
                        ? <span className="bg-amber-50 text-amber-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-inset ring-amber-100">High Overhead</span>
                        : null}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                          <span className="flex items-center gap-1.5">
                            Effort Sink
                            <Tooltip text="What share of the org's total sprint allocation points went to this project. High effort sink = a lot of team time invested.">
                              <HelpCircle className="h-3 w-3 text-slate-300 cursor-help" />
                            </Tooltip>
                          </span>
                          <span>{p.effortPct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden">
                          <div style={{ width: `${p.effortPct}%` }} className="h-full bg-slate-300 transition-all duration-700" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-violet-400">
                          <span className="flex items-center gap-1.5">
                            Results Yield
                            <Tooltip text="What share of the org's total recognition score was attributed to this project. High yield = work here gets seen and rewarded.">
                              <HelpCircle className="h-3 w-3 text-violet-200 cursor-help" />
                            </Tooltip>
                          </span>
                          <span>{p.recPct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 bg-violet-50 rounded-full overflow-hidden">
                          <div style={{ width: `${p.recPct}%` }} className="h-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.3)] transition-all duration-700" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
        )}

        {/* QUALITY */}
        {tab === "quality" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 ml-1">Top Issue Categories</h3>
              {qualityStats.issues.length === 0
                ? <div className="text-center py-12 text-slate-300 italic border border-dashed border-slate-200 rounded-3xl text-sm">No deductions recorded for this sprint.</div>
                : <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-6 shadow-sm">
                    {qualityStats.issues.map(iss => (
                      <div key={iss.name} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-tight text-slate-500">
                          <span>{iss.name}</span>
                          <span className="text-red-500">{iss.total} issues</span>
                        </div>
                        <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                          <div style={{ width: `${(iss.total / qualityStats.issues[0].total) * 100}%` }} className="h-full bg-red-400" />
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
            {viewMode === "list"
              ? <RankingList data={qualityStats.ranking.map(r => ({ profile: r.profile, total: r.bugs }))} subtext="bug violations" unit="x" />
              : <RankingGraph data={qualityStats.ranking.map(r => ({ profile: r.profile, total: r.bugs }))} unit="x" />
            }
          </div>
        )}

        {/* HEALTH */}
        {tab === "utilization" && (
          resourceHealth.length === 0
            ? <div className="text-center py-20 text-slate-300 italic border border-dashed border-slate-200 rounded-3xl">No team members found.</div>
            : <div className="space-y-8">

                {/* Sprint trend graph */}
                {sprints.length > 0 && (
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-base font-black text-slate-900">
                          {healthPersonFilter === "all" ? "Team Health per Sprint" : `${orgUsers.find(u => u.id === healthPersonFilter)?.full_name} — Allocation Trend`}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                          {healthPersonFilter === "all" ? "Distribution of overloaded / balanced / underutilised across sprints" : "Project allocation % in each sprint"}
                        </p>
                      </div>
                      <Users className="h-5 w-5 text-slate-300" />
                    </div>

                    {healthPersonFilter === "all" ? (
                      // Team view: stacked count bars per sprint
                      <div className="space-y-4">
                        {(healthTrendData as { sprintName: string; counts: { overloaded: number; balanced: number; underutilized: number }; total: number }[]).map(row => (
                          <div key={row.sprintName} className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                              <span>{row.sprintName}</span>
                              <span className="flex gap-3">
                                {row.counts.overloaded > 0 && <span className="text-red-400">{row.counts.overloaded} over</span>}
                                <span className="text-emerald-500">{row.counts.balanced} ok</span>
                                {row.counts.underutilized > 0 && <span className="text-blue-400">{row.counts.underutilized} under</span>}
                              </span>
                            </div>
                            <div className="flex h-3 w-full rounded-full overflow-hidden gap-px bg-slate-50">
                              {row.total > 0 && <>
                                {row.counts.overloaded > 0 && <div style={{ width: `${(row.counts.overloaded / row.total) * 100}%` }} className="bg-red-400 h-full" />}
                                {row.counts.balanced > 0 && <div style={{ width: `${(row.counts.balanced / row.total) * 100}%` }} className="bg-emerald-400 h-full" />}
                                {row.counts.underutilized > 0 && <div style={{ width: `${(row.counts.underutilized / row.total) * 100}%` }} className="bg-blue-300 h-full" />}
                              </>}
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-5 pt-2">
                          {[{ color: "bg-red-400", label: "Overloaded (>100%)" }, { color: "bg-emerald-400", label: "Balanced (50–100%)" }, { color: "bg-blue-300", label: "Underutilised (<50%)" }].map(l => (
                            <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                              <div className={cn("h-2 w-3 rounded-sm", l.color)} />{l.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      // Person view: their alloc % in each sprint
                      <div className="space-y-4">
                        {(healthTrendData as { sprintName: string; alloc: number; status: string }[]).map(row => (
                          <div key={row.sprintName} className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                              <span>{row.sprintName}</span>
                              <span className={cn(
                                row.status === "overloaded" ? "text-red-500" : row.status === "underutilized" ? "text-blue-500" : "text-emerald-500"
                              )}>{row.alloc}%</span>
                            </div>
                            <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${Math.min(row.alloc, 100)}%` }}
                                className={cn("h-full transition-all duration-700 rounded-full",
                                  row.status === "overloaded" ? "bg-red-400" : row.status === "underutilized" ? "bg-blue-300" : "bg-emerald-400"
                                )}
                              />
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-5 pt-2">
                          {[{ color: "bg-red-400", label: "Overloaded (>100%)" }, { color: "bg-emerald-400", label: "Balanced (50–100%)" }, { color: "bg-blue-300", label: "Underutilised (<50%)" }].map(l => (
                            <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                              <div className={cn("h-2 w-3 rounded-sm", l.color)} />{l.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* No-allocation banner */}
                {resourceHealth.every(e => e.alloc === 0) && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                    <Activity className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span><strong>No sprint allocations set yet.</strong> Assign project allocations in a sprint to see utilisation data here.</span>
                  </div>
                )}

                {/* Individual health cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {resourceHealth
                    .filter(e => healthPersonFilter === "all" || e.user.id === healthPersonFilter)
                    .map(entry => (
                      <div
                        key={entry.user.id}
                        className={cn(
                          "rounded-3xl border p-6 flex items-center justify-between transition-all",
                          entry.status === "overloaded" ? "border-red-100 bg-red-50/20" : entry.status === "underutilized" ? "border-blue-100 bg-blue-50/20" : "border-slate-100 bg-white",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 ring-2 ring-white">
                            <AvatarImage src={entry.user.avatar_url || undefined} />
                            <AvatarFallback className="bg-violet-100 text-violet-700 font-bold">{getInitials(entry.user.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 truncate">{entry.user.full_name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mt-1">{entry.status}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-xl font-black", entry.status === "overloaded" ? "text-red-500" : entry.status === "underutilized" ? "text-blue-500" : "text-slate-900")}>
                            {entry.alloc}%
                          </p>
                          <div className="mt-1 flex gap-0.5 justify-end">
                            {[1, 2, 3].map(i => (
                              <div key={i} className={cn("h-1 w-3 rounded-full", entry.alloc >= i * 33 ? (entry.status === "overloaded" ? "bg-red-400" : "bg-emerald-400") : "bg-slate-100")} />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function RankingList({ data, subtext, unit }: { data: { profile: Profile; total: number; subtext?: string }[]; subtext?: string; unit: string }) {
  if (data.length === 0) return <div className="text-center py-20 text-slate-300 italic border border-dashed border-slate-200 rounded-3xl">Empty leaderboard.</div>;
  return (
    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
      <div className="grid divide-y divide-slate-50">
        {data.map((row, i) => (
          <div key={row.profile.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:p-5 hover:bg-slate-50/50 transition-colors">
            <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black", i === 0 ? "bg-amber-100 text-amber-600" : "bg-slate-50 text-slate-400")}>{i + 1}</div>
            <Avatar className="h-9 w-9 flex-shrink-0 sm:h-10 sm:w-10"><AvatarImage src={row.profile.avatar_url || undefined} /><AvatarFallback className="bg-violet-100 text-violet-700 font-bold">{getInitials(row.profile.full_name)}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black text-slate-900 truncate tracking-tight">{row.profile.full_name}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 truncate">{row.profile.job_title || "Team Member"}</p>
            </div>
            <div className="text-right flex-shrink-0 pl-2">
              <p className={cn("text-base sm:text-lg font-black leading-none whitespace-nowrap", i === 0 ? "text-amber-600" : "text-violet-600")}>{Math.round(row.total)}{unit}</p>
              <span className="hidden sm:block text-[9px] text-slate-400 uppercase font-black whitespace-nowrap pt-0.5">
                {row.subtext || subtext}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingGraph({ data, unit }: { data: { profile: Profile; total: number }[]; unit: string }) {
  const max = data.length > 0 ? data[0].total : 1;
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-5">
      {data.map((row, i) => (
        <div key={row.profile.id} className="space-y-2">
          <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 px-1">
            <span>{row.profile.full_name}</span>
            <span>{Math.round(row.total)}{unit}</span>
          </div>
          <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
            <div style={{ width: `${(row.total / max) * 100}%` }} className={cn("h-full transition-all duration-1000", i === 0 ? "bg-amber-400" : "bg-violet-500")} />
          </div>
        </div>
      ))}
    </div>
  );
}
