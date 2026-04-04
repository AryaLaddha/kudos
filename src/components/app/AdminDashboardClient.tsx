"use client";

import { useMemo } from "react";
import { 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  Briefcase, 
  Zap, 
  Trophy, 
  AlertCircle,
  Clock
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
  id: string;
  sprint_id: string;
  user_id: string;
  base_points: number;
  scores: Record<string, number>;
  project_allocations: Record<string, number>;
  profile: Profile;
}

interface Props {
  sprints: Sprint[];
  projects: Project[];
  participants: Participant[];
  orgUsers: Profile[];
}

function getInitials(n: string) { return n.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2); }

// ── Components ────────────────────────────────────────────────

export default function AdminDashboardClient({ sprints, projects, participants, orgUsers }: Props) {
  
  // ── Calculation 1: High Level KPIs ──
  const kpis = useMemo(() => {
    const totalPointsSpent = participants.reduce((total, p) => {
      const won = Object.values(p.scores).reduce((s, v) => s + (v > 0 ? v : 0), 0); // Simplified win logic
      return total + won;
    }, 0);
    const activeProjects = projects.length;
    const avgTeamPoints = sprints.length > 0 ? (totalPointsSpent / sprints.length) : 0;
    
    return {
      totalPointsSpent,
      activeProjects,
      totalPeople: orgUsers.length,
      avgTeamPoints: Math.round(avgTeamPoints)
    };
  }, [participants, projects, sprints, orgUsers]);

  // ── Calculation 2: Resource Heatmap ──
  // Latest project allocation per person (from the most recent sprint they were in)
  const latestAllocations = useMemo(() => {
    const sortedSprints = [...sprints].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    
    return orgUsers.map(user => {
      // Find the most recent sprint where this user has allocations
      const userSprints = participants
        .filter(p => p.user_id === user.id)
        .sort((a, b) => {
          const sA = sprints.find(s => s.id === a.sprint_id);
          const sB = sprints.find(s => s.id === b.sprint_id);
          return new Date(sB?.start_date || "").getTime() - new Date(sA?.start_date || "").getTime();
        });

      const latest = userSprints[0];
      const allocs = latest?.project_allocations || {};
      const total = Object.values(allocs).reduce((s, v) => s + v, 0);

      return {
        user,
        allocs,
        total,
        isOverloaded: total > 100
      };
    });
  }, [orgUsers, participants, sprints]);

  // ── Calculation 3: Hall of Fame (Total Points over time) ──
  const hallOfFame = useMemo(() => {
    const stats: Record<string, { profile: Profile; totalWins: number; totalBugs: number; net: number }> = {};
    
    participants.forEach(p => {
      if (!stats[p.user_id]) stats[p.user_id] = { profile: p.profile, totalWins: 0, totalBugs: 0, net: 0 };
      
      // In our current schema, won/deducted are mixed in 'scores'
      // For this report, we'll assume anything > 0 is win, anything else is deduction
      // (Better: filter by the column metadata from sprint, but this is a good proxy)
      Object.values(p.scores).forEach(v => {
        if (v > 0) stats[p.user_id].totalWins += v;
        else stats[p.user_id].totalBugs += Math.abs(v);
      });
      stats[p.user_id].net += stats[p.user_id].totalWins - stats[p.user_id].totalBugs;
    });

    return Object.values(stats).sort((a, b) => b.net - a.net).slice(0, 5);
  }, [participants]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 shadow-lg shadow-violet-200">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 leading-none">Admin Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
              Org Command Center <span className="h-1 w-1 rounded-full bg-slate-300" /> Real-time Analytics
            </p>
          </div>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Points Earned", val: kpis.totalPointsSpent, icon: Zap, color: "text-amber-500", bg: "bg-amber-50" },
          { label: "Active Team", val: kpis.totalPeople, icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Total Projects", val: kpis.activeProjects, icon: Briefcase, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Sprint Avg", val: kpis.avgTeamPoints, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
        ].map((kpi, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("p-2 rounded-xl", kpi.bg)}>
                <kpi.icon className={cn("h-5 w-5", kpi.color)} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</span>
            </div>
            <div className="text-3xl font-black text-slate-900">{kpi.val.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Hall of Fame Ranking */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Trophy className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Leaderboard Legends</h2>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white shadow-sm p-4 divide-y divide-slate-50">
            {hallOfFame.map((stat, i) => (
              <div key={stat.profile.id} className="flex items-center gap-4 py-4 first:pt-2 last:pb-2">
                <div className={cn(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black",
                  i === 0 ? "bg-amber-100 text-amber-600 shadow-sm shadow-amber-100" : "bg-slate-50 text-slate-400"
                )}>
                  {i + 1}
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={stat.profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-violet-100 text-violet-700 font-bold">
                    {getInitials(stat.profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{stat.profile.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{stat.profile.job_title || "Team Member"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-violet-600">+{stat.net}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Total Net</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resource Heatmap Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600">Current Resource Effort</h2>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400">
               <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-violet-100" /> Assigned</span>
               <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-100" /> Over 100%</span>
            </div>
          </div>
          
          <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden overflow-x-auto">
            <table className="min-w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-tighter text-xs">Resource</th>
                  {projects.slice(0, 4).map(p => (
                    <th key={p.id} className="px-4 py-4 font-bold text-slate-500 uppercase tracking-tighter text-xs text-center truncate max-w-[100px]">
                      {p.name}
                    </th>
                  ))}
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-tighter text-xs text-center border-l border-slate-100">Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {latestAllocations.map(entry => (
                  <tr key={entry.user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={entry.user.avatar_url || undefined} />
                          <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-bold">
                            {getInitials(entry.user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-semibold text-slate-900">{entry.user.full_name}</span>
                      </div>
                    </td>
                    {projects.slice(0, 4).map(p => {
                      const val = entry.allocs[p.id] || 0;
                      return (
                        <td key={p.id} className="px-4 py-3 text-center">
                          {val > 0 ? (
                            <div className="inline-flex h-8 w-12 items-center justify-center rounded-lg bg-violet-50 text-violet-600 font-bold text-xs ring-1 ring-inset ring-violet-100">
                              {val}%
                            </div>
                          ) : (
                            <span className="text-slate-200">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-6 py-3 text-center border-l border-slate-100 bg-slate-50/10">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-inset",
                        entry.isOverloaded ? "bg-red-50 text-red-600 ring-red-100" : entry.total === 0 ? "bg-slate-50 text-slate-400 ring-slate-100" : "bg-emerald-50 text-emerald-600 ring-emerald-100"
                      )}>
                        {entry.isOverloaded && <AlertCircle className="h-3 w-3" />}
                        {entry.total}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {projects.length > 4 && (
              <div className="px-6 py-3 bg-slate-50/30 text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest border-t border-slate-100">
                + {projects.length - 4} more projects hidden in overview
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team Velocity Summary */}
      <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Team Velocity Trend</h2>
            <p className="text-sm text-slate-500">Average points per sprint across the organization</p>
          </div>
        </div>
        
        <div className="h-48 w-full flex items-end gap-2 px-2 pb-6 border-b border-slate-100">
          {[...sprints].reverse().slice(-7).map((s, i) => {
            const sprintParticipants = participants.filter(p => p.sprint_id === s.id);
            const total = sprintParticipants.reduce((sum, p) => sum + p.base_points, 0); // Simplified velocity
            const avg = sprintParticipants.length > 0 ? (total / sprintParticipants.length) : 0;
            const height = Math.min(100, Math.max(20, (avg / 30) * 100)); // Scaled
            
            return (
              <div key={s.id} className="flex-1 group relative">
                <div 
                  style={{ height: `${height}%` }}
                  className="w-full bg-violet-100 group-hover:bg-violet-600 rounded-t-xl transition-all duration-300 shadow-sm"
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-bold shadow-xl">
                  {Math.round(avg)} pts
                </div>
                <div className="absolute -bottom-8 left-0 right-0 text-center text-[10px] font-bold text-slate-400 rotate-[-45deg] origin-top-left truncate pr-2">
                  {s.name}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-12 flex items-center gap-6 justify-center">
            <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <div className="h-3 w-3 rounded-md bg-violet-100" /> Avg Points
            </span>
            <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <div className="h-3 w-3 rounded-md bg-emerald-500" /> Target Line
            </span>
        </div>
      </div>
    </div>
  );
}
