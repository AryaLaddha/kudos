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
  SearchIcon,
  Briefcase,
  TrendingDown,
  TrendingUp,
  Percent,
  Scale,
  ShieldAlert,
  Flame,
  Snowflake,
  Activity,
  Award
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

// ── Components ────────────────────────────────────────────────

export default function AdminDashboardClient({
  sprints,
  projects,
  participants,
  orgUsers,
  userGoals,
  goalDefinitions,
  recognitions
}: Props) {
  
  const [tab, setTab] = useState<"recognition" | "sprint" | "goals" | "projects" | "quality" | "utilization">("recognition");
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  
  // Filters
  const [recognitionFilter, setRecognitionFilter] = useState<{ type: "all" | "month", monthValue?: string }>({ type: "all" });
  const [sprintFilter, setSprintFilter] = useState<string>("all_time");
  const [goalFilter, setGoalFilter] = useState<string>("all");

  // Colors for Goal Categories (Heatmap)
  const CATEGORY_COLORS: Record<string, string> = {
    "Learning & Certification": "bg-violet-500",
    "Sprint Contribution": "bg-emerald-500",
    "Productivity & Efficiency": "bg-amber-500",
    "Practice Growth": "bg-blue-500",
    "Collaboration & Quality": "bg-rose-500"
  };

  // ── 1. Recognition Leaderboard (from recognitions table) ──
  const recognitionRanking = useMemo(() => {
    let filtered = recognitions;
    if (recognitionFilter.type === "month" && recognitionFilter.monthValue) {
      filtered = recognitions.filter(r => r.created_at.startsWith(recognitionFilter.monthValue!));
    }
    const stats: Record<string, { profile: Profile; total: number }> = {};
    // Build a lookup for orgUsers by id
    const userMap: Record<string, Profile> = {};
    orgUsers.forEach(u => { userMap[u.id] = u; });

    filtered.forEach(r => {
      // Collect all receivers (single + multi-receiver posts)
      const receivers = [
        ...(r.receiver_id ? [r.receiver_id] : []),
        ...(r.receiver_ids ?? [])
      ];
      // Deduplicate in case receiver_id is also in receiver_ids
      const unique = Array.from(new Set(receivers));
      unique.forEach(uid => {
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
      if (!p.profile) return; // skip orphaned participant rows
      const scores = p.scores ?? {};
      if (!stats[p.user_id]) stats[p.user_id] = { profile: p.profile, total: 0 };
      const won = Object.values(scores).reduce((s, v) => s + (v > 0 ? v : 0), 0);
      const ded = Object.values(scores).reduce((s, v) => s + (v < 0 ? Math.abs(v) : 0), 0);
      const net = p.base_points + won - ded;
      if (sprintFilter === "all_time") stats[p.user_id].total += net; else stats[p.user_id].total = net;
    });
    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [participants, sprintFilter]);

  // ── 3. Goals & Category Heatmap ──
  const { goalList, goalCategoryStats } = useMemo(() => {
    const list = userGoals.filter(ug => ug.status === "achieved").map(ug => ({
      ...ug,
      user: orgUsers.find(u => u.id === ug.user_id),
      goal: goalDefinitions.find(g => g.id === ug.goal_id)
    })).filter(ug => goalFilter === "all" || ug.goal_id === goalFilter)
       .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const catStats: Record<string, number> = {};
    const totalAchieved = userGoals.filter(ug => ug.status === "achieved").length;
    userGoals.filter(ug => ug.status === "achieved").forEach(ug => {
      const g = goalDefinitions.find(def => def.id === ug.goal_id);
      if (g) catStats[g.category] = (catStats[g.category] || 0) + 1;
    });

    return { 
      goalList: list, 
      goalCategoryStats: Object.entries(catStats).map(([name, count]) => ({ name, count, pct: (count / totalAchieved) * 100 }))
                         .sort((a, b) => b.count - a.count)
    };
  }, [userGoals, goalFilter, orgUsers, goalDefinitions]);

  // ── 4. Project Efficiency ──
  const projectEfficiency = useMemo(() => {
    const stats: Record<string, { id: string; name: string; totalEffort: number; totalRecognition: number }> = {};
    projects.forEach(p => stats[p.id] = { id: p.id, name: p.name, totalEffort: 0, totalRecognition: 0 });
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
    return Object.values(stats).map(p => ({
      ...p,
      effortPct: totalEffort > 0 ? (p.totalEffort / totalEffort) * 100 : 0,
      recPct: totalRec > 0 ? (p.totalRecognition / totalRec) * 100 : 0
    })).map(p => ({ ...p, ratio: p.effortPct > 0 ? (p.recPct / p.effortPct) : 0 }))
       .sort((a, b) => b.ratio - a.ratio);
  }, [projects, participants]);

  // ── 5. Quality Control (Deductions) ──
  const qualityStats = useMemo(() => {
    const itemTotals: Record<string, number> = {};
    const userStats: Record<string, { profile: Profile; bugs: number }> = {};

    participants.forEach(p => {
      if (!p.profile) return;
      const scores = p.scores ?? {};
      Object.entries(scores).forEach(([key, val]) => {
        if (val < 0) { // Deductions
          const abs = Math.abs(val);
          itemTotals[key] = (itemTotals[key] || 0) + abs;
          if (!userStats[p.user_id]) userStats[p.user_id] = { profile: p.profile, bugs: 0 };
          if (key === "bugs") userStats[p.user_id].bugs += abs;
        }
      });
    });

    const ranking = Object.values(userStats).filter(u => u.bugs > 0).sort((a, b) => b.bugs - a.bugs);
    const issues = Object.entries(itemTotals).map(([name, total]) => ({ name, total }))
                    .sort((a, b) => b.total - a.total);

    return { ranking, issues };
  }, [participants]);

  // ── 6. Resource Utilization ──
  const resourceHealth = useMemo(() => {
    return orgUsers.map(user => {
      // Find latest sprint for this user
      const sortedP = participants.filter(p => p.user_id === user.id)
        .sort((a, b) => {
           const sA = sprints.find(s => s.id === a.sprint_id);
           const sB = sprints.find(s => s.id === b.sprint_id);
           return new Date(sB?.start_date || "").getTime() - new Date(sA?.start_date || "").getTime();
        });
      const latest = sortedP[0];
      const alloc = Object.values(latest?.project_allocations || {}).reduce((s, v) => s + v, 0);
      return {
        user,
        alloc,
        status: alloc > 100 ? "overloaded" : alloc < 50 ? "underutilized" : "balanced"
      };
    }).sort((a, b) => b.alloc - a.alloc);
  }, [orgUsers, participants, sprints]);

  // ── Helpers ──
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    recognitions.forEach(r => months.add(r.created_at.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [recognitions]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-32">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Insights</h1>
          <p className="text-slate-500 mt-1 font-medium italic">Strategic reporting and team health monitoring</p>
        </div>
        
        <div className="inline-flex p-1 bg-slate-100/80 rounded-2xl overflow-x-auto max-w-full">
          {[
            { id: "recognition", label: "Recognition", icon: Zap },
            { id: "sprint", label: "Sprints", icon: Trophy },
            { id: "goals", label: "Practice", icon: Target },
            { id: "projects", label: "ROI", icon: Briefcase },
            { id: "quality", label: "Quality", icon: ShieldAlert },
            { id: "utilization", label: "Health", icon: Activity },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id as any); setViewMode("list"); }}
              className={cn(
                "px-4 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2 transition-all whitespace-nowrap",
                tab === t.id ? "bg-white text-violet-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Specific Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {tab === "recognition" && (
            <select className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700" value={recognitionFilter.type === "all" ? "all" : recognitionFilter.monthValue} onChange={(e) => e.target.value === "all" ? setRecognitionFilter({ type: "all" }) : setRecognitionFilter({ type: "month", monthValue: e.target.value })}>
              <option value="all">All Time History</option>
              {monthOptions.map(m => <option key={m} value={m}>{new Date(m + "-01").toLocaleString('en-US', { month: 'long', year: 'numeric' })}</option>)}
            </select>
          )}

          {tab === "sprint" && (
            <select className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700" value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)}>
              <option value="all_time">All Time Points</option>
              {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          {tab === "goals" && (
            <select className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 max-w-[300px]" value={goalFilter} onChange={(e) => setGoalFilter(e.target.value)}>
              <option value="all">Explore Achievements</option>
              {goalDefinitions.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          )}
          
          {(tab === "projects" || tab === "quality" || tab === "utilization") && (
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2">
               <Activity className="h-3 w-3" /> System Oversight Active
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <p className="text-xs font-medium text-slate-400 italic max-w-xs leading-tight">
            {tab === "recognition" && "Track team recognition points and extra performance bonuses across any time period."}
            {tab === "sprint" && "Cumulative performance audit: Base points plus net wins and deductions per sprint."}
            {tab === "goals" && "Team growth heatmap: Tracking certifications, professional development, and contribution goals."}
            {tab === "projects" && "Project efficiency index: Comparing team effort (allocation) vs. actual recognized results."}
            {tab === "quality" && "Systemic issue monitor: Tracking bugs, absences, and communication audit trends."}
            {tab === "utilization" && "Resource utilization audit: Live overview of team workload and burnout risk."}
          </p>
          {(tab === "recognition" || tab === "sprint" || tab === "quality") && (
            <div className="flex p-0.5 bg-slate-100/60 rounded-lg">
              <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-md transition-all", viewMode === "list" ? "bg-white text-violet-600 shadow-sm" : "text-slate-400")}><ListOrdered className="h-4 w-4" /></button>
              <button onClick={() => setViewMode("graph")} className={cn("p-1.5 rounded-md transition-all", viewMode === "graph" ? "bg-white text-violet-600 shadow-sm" : "text-slate-400")}><BarChart3 className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>

      {/* Main View Area */}
      <div className="space-y-6">
        
        {/* RECOGNITION & SPRINT */}
        {tab === "recognition" && (viewMode === "list" ? <RankingList data={recognitionRanking} subtext="kudos received" unit="pts" /> : <RankingGraph data={recognitionRanking} unit="pts" />)}
        {tab === "sprint" && (viewMode === "list" ? <RankingList data={sprintRanking} subtext="net performance" unit="pts" /> : <RankingGraph data={sprintRanking} unit="pts" />)}

        {/* PRACTICE GROWTH (GOALS) */}
        {tab === "goals" && (
          <div className="space-y-10">
            {/* Heatmap/Breakdown */}
            {goalFilter === "all" && (
              <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 mb-8">Practice Focus Heatmap</h3>
                <div className="flex flex-col md:flex-row gap-10 items-center">
                  <div className="flex-1 w-full space-y-5">
                    {goalCategoryStats.map(cat => (
                      <div key={cat.name} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                          <span>{cat.name}</span>
                          <span className="text-slate-900">{cat.count} logs</span>
                        </div>
                        <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden">
                           <div style={{ width: `${cat.pct}%` }} className={cn("h-full transition-all duration-1000", CATEGORY_COLORS[cat.name] || "bg-slate-300")} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="w-full md:w-64 aspect-square rounded-full border-[16px] border-slate-50 flex flex-center items-center justify-center relative">
                      <div className="text-center">
                        <p className="text-4xl font-black text-slate-900">{userGoals.length}</p>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Total logs</p>
                      </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid gap-4">
              {goalList.slice(0, 15).map(ug => (
                <div key={ug.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center gap-6">
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

        {/* QUALITY CONTROL */}
        {tab === "quality" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 ml-1">Top Issue Categories</h3>
              <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-6 shadow-sm">
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
            </div>
            {viewMode === "list" ? (
              <RankingList data={qualityStats.ranking.map(r => ({ profile: r.profile, total: r.bugs }))} subtext="bug violations" unit="x" />
            ) : (
              <RankingGraph data={qualityStats.ranking.map(r => ({ profile: r.profile, total: r.bugs }))} unit="x" />
            )}
          </div>
        )}

        {/* ROI / PROJECTS */}
        {tab === "projects" && (
          projectEfficiency.length === 0 ? (
            <div className="text-center py-20 text-slate-300 italic border border-dashed border-slate-200 rounded-3xl">
              No projects yet — create projects in the Sprints page and assign allocations to participants.
            </div>
          ) :
          <div className="grid gap-6">
            {projectEfficiency.map(p => (
              <div key={p.id} className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm">
                 <div className="flex justify-between items-start gap-4 mb-8">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-violet-50 rounded-xl"><Briefcase className="h-5 w-5 text-violet-600" /></div>
                       <div><h3 className="text-xl font-black text-slate-900 leading-none">{p.name}</h3><p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">ROI Index: <span className="text-violet-600">{p.ratio.toFixed(2)}x</span></p></div>
                    </div>
                    {p.ratio > 1.25 ? <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-inset ring-emerald-100">Super Impact</span> : p.ratio < 0.75 ? <span className="bg-amber-50 text-amber-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-inset ring-amber-100">High Overhead</span> : null}
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                       <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Effort Sink</span><span>{p.effortPct.toFixed(1)}%</span></div>
                       <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden"><div style={{ width: `${p.effortPct}%` }} className="h-full bg-slate-300" /></div>
                    </div>
                    <div className="space-y-3">
                       <div className="flex justify-between text-[10px] font-black uppercase text-violet-400"><span>Results Yield</span><span>{p.recPct.toFixed(1)}%</span></div>
                       <div className="h-2.5 bg-violet-50 rounded-full overflow-hidden"><div style={{ width: `${p.recPct}%` }} className="h-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.3)]" /></div>
                    </div>
                 </div>
              </div>
            ))}
          </div>
        )}

        {/* RESOURCE UTILIZATION / HEALTH */}
        {tab === "utilization" && (
          resourceHealth.length === 0 ? (
            <div className="text-center py-20 text-slate-300 italic border border-dashed border-slate-200 rounded-3xl">
              No team members found.
            </div>
          ) :
          <div className="space-y-4">
            {resourceHealth.every(e => e.alloc === 0) && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                <Activity className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span><strong>No sprint allocations set yet.</strong> Assign project allocations in a sprint to see utilization data here.</span>
              </div>
            )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resourceHealth.map(entry => (
               <div key={entry.user.id} className={cn(
                 "rounded-3xl border p-6 flex items-center justify-between transition-all",
                 entry.status === "overloaded" ? "border-red-100 bg-red-50/20" : entry.status === "underutilized" ? "border-blue-100 bg-blue-50/20" : "border-slate-100 bg-white"
               )}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-white"><AvatarImage src={entry.user.avatar_url || undefined} /><AvatarFallback className="bg-violet-100 text-violet-700 font-bold">{getInitials(entry.user.full_name)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{entry.user.full_name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mt-1">{entry.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-xl font-black", entry.status === "overloaded" ? "text-red-500" : entry.status === "underutilized" ? "text-blue-500" : "text-slate-900")}>{entry.alloc}%</p>
                    <div className="mt-1 flex gap-0.5 justify-end">
                       {[1,2,3].map(i => <div key={i} className={cn("h-1 w-3 rounded-full", entry.alloc >= (i * 33) ? (entry.status === "overloaded" ? "bg-red-400" : "bg-emerald-400") : "bg-slate-100")} />)}
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

// ── Sub-Components ───────────────────────────────────────────

function RankingList({ data, subtext, unit }: { data: any[], subtext: string, unit: string }) {
  if (data.length === 0) return <div className="text-center py-20 text-slate-300 italic border border-dashed border-slate-200 rounded-3xl">Empty leaderboard.</div>;
  return (
    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
      <div className="grid divide-y divide-slate-50">
        {data.map((row, i) => (
          <div key={row.profile.id} className="flex items-center gap-4 p-5 hover:bg-slate-50/50 transition-colors">
            <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black", i === 0 ? "bg-amber-100 text-amber-600" : "bg-slate-50 text-slate-400")}>{i + 1}</div>
            <Avatar className="h-10 w-10"><AvatarImage src={row.profile.avatar_url || undefined} /><AvatarFallback className="bg-violet-100 text-violet-700 font-bold">{getInitials(row.profile.full_name)}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0"><h3 className="text-sm font-black text-slate-900 truncate tracking-tight">{row.profile.full_name}</h3><p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{row.profile.job_title || "Team Member"}</p></div>
            <div className="text-right">
              <p className={cn("text-lg font-black leading-none", i === 0 ? "text-amber-600" : "text-violet-600")}>{Math.round(row.total)}{unit}</p>
              <span className="text-[9px] text-slate-400 uppercase font-black">{subtext}</span>
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
    <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-5">
      {data.map((row, i) => (
        <div key={row.profile.id} className="space-y-2">
          <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 px-1"><span>{row.profile.full_name}</span><span>{Math.round(row.total)}{unit}</span></div>
          <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden"><div style={{ width: `${(row.total / max) * 100}%` }} className={cn("h-full transition-all duration-1000", i === 0 ? "bg-amber-400" : "bg-violet-500")} /></div>
        </div>
      ))}
    </div>
  );
}
