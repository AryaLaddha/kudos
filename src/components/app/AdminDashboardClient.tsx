"use client";

import { useMemo, useState } from "react";
import { 
  Trophy, 
  BarChart3, 
  ListOrdered, 
  Search,
  ChevronDown,
  Calendar,
  Zap,
  Target,
  SearchIcon
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
  columns?: { won: { id: string; name: string }[]; deducted: { id: string; name: string }[] };
}
interface Project { id: string; name: string; }
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

interface Props {
  sprints: Sprint[];
  projects: Project[];
  participants: Participant[];
  orgUsers: Profile[];
  userGoals: UserGoal[];
  goalDefinitions: GoalDefinition[];
}

function getInitials(n: string) { return n.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2); }

// ── Components ────────────────────────────────────────────────

export default function AdminDashboardClient({ 
  sprints, 
  participants, 
  orgUsers, 
  userGoals,
  goalDefinitions 
}: Props) {
  
  const [tab, setTab] = useState<"recognition" | "sprint" | "goals">("recognition");
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  
  // Filters
  const [recognitionFilter, setRecognitionFilter] = useState<{ type: "all" | "month", monthValue?: string }>({ type: "all" });
  const [sprintFilter, setSprintFilter] = useState<string>("all_time");
  const [goalFilter, setGoalFilter] = useState<string>("all");

  // ── 1. Recognition Leaderboard Calculation ──
  const recognitionRanking = useMemo(() => {
    let filtered = participants;
    
    if (recognitionFilter.type === "month" && recognitionFilter.monthValue) {
      const targetMonth = recognitionFilter.monthValue; // "2026-04"
      filtered = participants.filter(p => {
        const s = sprints.find(sp => sp.id === p.sprint_id);
        return s?.start_date.startsWith(targetMonth);
      });
    }

    const stats: Record<string, { profile: Profile; total: number }> = {};
    filtered.forEach(p => {
      if (!stats[p.user_id]) stats[p.user_id] = { profile: p.profile, total: 0 };
      // Look for the "recognition" score. Fallback to any positive value if not found.
      const recognitionAmt = p.scores["recognition"] || 0;
      stats[p.user_id].total += recognitionAmt;
    });

    return Object.values(stats)
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [participants, recognitionFilter, sprints]);

  // ── 2. Sprint Leaderboard Calculation ──
  const sprintRanking = useMemo(() => {
    let filtered = participants;
    
    if (sprintFilter !== "all_time") {
      filtered = participants.filter(p => p.sprint_id === sprintFilter);
    }

    const stats: Record<string, { profile: Profile; total: number }> = {};
    filtered.forEach(p => {
      if (!stats[p.user_id]) stats[p.user_id] = { profile: p.profile, total: 0 };
      
      const won = Object.values(p.scores).reduce((s, v) => s + (v > 0 ? v : 0), 0);
      const ded = Object.values(p.scores).reduce((s, v) => s + (v < 0 ? Math.abs(v) : 0), 0);
      const net = p.base_points + won - ded;
      
      if (sprintFilter === "all_time") {
        stats[p.user_id].total += net;
      } else {
        // Individual sprint view is usually just the absolute total for that one.
        stats[p.user_id].total = net;
      }
    });

    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [participants, sprintFilter]);

  // ── 3. Goals Completion Tracker Calculation ──
  const goalCompletions = useMemo(() => {
    let filtered = userGoals.filter(ug => ug.status === "achieved");
    if (goalFilter !== "all") {
      filtered = filtered.filter(ug => ug.goal_id === goalFilter);
    }

    return filtered.map(ug => {
      const user = orgUsers.find(u => u.id === ug.user_id);
      const goal = goalDefinitions.find(g => g.id === ug.goal_id);
      return { ...ug, user, goal };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [userGoals, goalFilter, orgUsers, goalDefinitions]);

  // ── Helper: Month Dropdown Options ──
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    sprints.forEach(s => months.add(s.start_date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [sprints]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-32">
      {/* Header & Main Tabs */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Analytics Dashboard</h1>
          <p className="text-slate-500 mt-1 font-medium">Organisation overview and leaderboards</p>
        </div>
        
        <div className="inline-flex p-1 bg-slate-100 rounded-2xl">
          {[
            { id: "recognition", label: "Recognition", icon: Zap },
            { id: "sprint", label: "Sprints", icon: Trophy },
            { id: "goals", label: "Goals", icon: Target },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all",
                tab === t.id ? "bg-white text-violet-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report Controls (Filters & Toggle) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {tab === "recognition" && (
            <select 
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500"
              value={recognitionFilter.type === "all" ? "all" : recognitionFilter.monthValue}
              onChange={(e) => {
                if (e.target.value === "all") setRecognitionFilter({ type: "all" });
                else setRecognitionFilter({ type: "month", monthValue: e.target.value });
              }}
            >
              <option value="all">All Time History</option>
              {monthOptions.map(m => <option key={m} value={m}>{new Date(m + "-01").toLocaleString('en-US', { month: 'long', year: 'numeric' })}</option>)}
            </select>
          )}

          {tab === "sprint" && (
            <select 
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500"
              value={sprintFilter}
              onChange={(e) => setSprintFilter(e.target.value)}
            >
              <option value="all_time">All Time Points</option>
              <optgroup label="Recent Sprints">
                {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            </select>
          )}

          {tab === "goals" && (
            <select 
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500 max-w-[300px]"
              value={goalFilter}
              onChange={(e) => setGoalFilter(e.target.value)}
            >
              <option value="all">All Achieved Goals</option>
              {goalDefinitions.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          )}
        </div>

        {tab !== "goals" && (
          <div className="flex p-0.5 bg-slate-100/60 rounded-lg">
            <button 
              onClick={() => setViewMode("list")}
              className={cn("p-1.5 rounded-md transition-all", viewMode === "list" ? "bg-white text-violet-600 shadow-sm" : "text-slate-400")}
            >
              <ListOrdered className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setViewMode("graph")}
              className={cn("p-1.5 rounded-md transition-all", viewMode === "graph" ? "bg-white text-violet-600 shadow-sm" : "text-slate-400")}
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Leaderboard Content */}
      <div className="space-y-6">
        {tab === "recognition" && viewMode === "list" && (
          <RankingList data={recognitionRanking} subtext="pts generated via recognition" unit="pts" />
        )}
        {tab === "recognition" && viewMode === "graph" && (
          <RankingGraph data={recognitionRanking} unit="pts" />
        )}
        
        {tab === "sprint" && viewMode === "list" && (
          <RankingList data={sprintRanking} subtext="points accumulated" unit="pts" />
        )}
        {tab === "sprint" && viewMode === "graph" && (
          <RankingGraph data={sprintRanking} unit="pts" />
        )}

        {tab === "goals" && (
          <div className="grid gap-4">
            {goalCompletions.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-20 text-center text-slate-400">
                <SearchIcon className="h-10 w-10 mx-auto mb-4 opacity-10" />
                No completions found for this filter.
              </div>
            ) : (
              goalCompletions.map(ug => (
                <div key={ug.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex items-center gap-4 flex-1">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={ug.user?.avatar_url || undefined} />
                      <AvatarFallback className="bg-violet-100 text-violet-700 font-bold">{getInitials(ug.user?.full_name || "?")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{ug.user?.full_name}</h3>
                      <p className="text-sm text-slate-500 font-bold mt-0.5">{ug.goal?.title || "Goal Description"}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded shadow-sm">Achieved</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(ug.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="md:w-1/3 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs italic text-slate-600 leading-relaxed relative">
                    <div className="absolute top-3 left-3 opacity-10 text-violet-600">
                       <Zap className="h-4 w-4 fill-current" />
                    </div>
                    "{ug.description}"
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-Components ───────────────────────────────────────────

function RankingList({ data, subtext, unit }: { data: any[], subtext: string, unit: string }) {
  if (data.length === 0) return <div className="text-center py-20 text-slate-400">No data found for this period.</div>;
  
  return (
    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
      <div className="grid divide-y divide-slate-50">
        {data.map((row, i) => (
          <div key={row.profile.id} className="flex items-center gap-4 p-5 hover:bg-slate-50/50 transition-colors">
            <div className={cn(
              "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black",
              i === 0 ? "bg-amber-100 text-amber-600 shadow-sm shadow-amber-100/50" : i === 1 ? "bg-slate-100 text-slate-500" : "bg-slate-50 text-slate-400"
            )}>
              {i + 1}
            </div>
            <Avatar className="h-12 w-12 grayscale-[0.5] hover:grayscale-0 transition-all">
              <AvatarImage src={row.profile.avatar_url || undefined} />
              <AvatarFallback className="bg-violet-100 text-violet-700 font-bold">{getInitials(row.profile.full_name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-base font-black text-slate-900 tracking-tight">{row.profile.full_name}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">{row.profile.job_title || "Explorer"}</p>
            </div>
            <div className="text-right">
              <p className={cn("text-xl font-black leading-none", i === 0 ? "text-amber-600" : "text-violet-600")}>{row.total}{unit}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{subtext}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingGraph({ data, unit }: { data: any[], unit: string }) {
  const max = data.length > 0 ? data[0].total : 1;
  
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-6">
      {data.map((row, i) => {
        const pct = (row.total / max) * 100;
        return (
          <div key={row.profile.id} className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
              <span className="flex items-center gap-2">
                <span className="text-slate-300 w-4">#{i+1}</span>
                {row.profile.full_name}
              </span>
              <span className="text-violet-600">{row.total}{unit}</span>
            </div>
            <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden">
               <div 
                 style={{ width: `${Math.max(5, pct)}%` }} 
                 className={cn("h-full rounded-full transition-all duration-1000", i === 0 ? "bg-amber-400" : "bg-violet-500")}
               />
            </div>
          </div>
        );
      })}
      {data.length === 0 && <div className="text-center py-10 text-slate-300 italic">Graph empty.</div>}
    </div>
  );
}
