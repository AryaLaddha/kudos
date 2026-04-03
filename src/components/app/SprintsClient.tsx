"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Zap, Plus, Calendar, Users, Loader2, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSprint, createProject, deleteProject, deleteSprint } from "@/app/(app)/sprints/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Sprint {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "active" | "completed";
  sprint_participants: { count: number }[];
}

interface Project {
  id: string;
  name: string;
}

interface Props {
  sprints: Sprint[];
  projects: Project[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isActive(sprint: Sprint) {
  const now = new Date();
  return new Date(sprint.start_date) <= now && new Date(sprint.end_date) >= now;
}

export default function SprintsClient({ sprints, projects }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Create sprint form state
  const [formName, setFormName] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formBase, setFormBase] = useState(20);
  const [creating, setCreating] = useState(false);

  async function handleCreateSprint(e: React.FormEvent) {
    e.preventDefault();
    if (!formName || !formStart || !formEnd) {
      toast.error("Fill out all sprint fields.");
      return;
    }
    setCreating(true);
    const res = await createSprint({ name: formName, start_date: formStart, end_date: formEnd, base_points: formBase });
    if ("error" in res && res.error) {
      toast.error(res.error);
    } else {
      toast.success("Sprint created!");
      setShowCreate(false);
      setFormName(""); setFormStart(""); setFormEnd("");
      startTransition(() => router.refresh());
    }
    setCreating(false);
  }

  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const res = await createProject(newProjectName.trim());
    if ("error" in res && res.error) toast.error(res.error);
    else { toast.success("Project added!"); setNewProjectName(""); startTransition(() => router.refresh()); }
    setShowProjectForm(false);
  }

  async function handleDeleteProject(id: string) {
    const res = await deleteProject(id);
    if ("error" in res && res.error) toast.error(res.error);
    else startTransition(() => router.refresh());
  }

  async function handleDeleteSprint(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete the sprint "${name}"? This will delete all associated point data.`)) return;
    const res = await deleteSprint(id);
    if ("error" in res && res.error) toast.error(res.error);
    else {
      toast.success("Sprint deleted");
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <Zap className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Sprint Tracker</h1>
            <p className="text-sm text-slate-500 mt-0.5">Admin view · Track team sprint points</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus className="h-4 w-4" />
          New Sprint
        </Button>
      </div>

      {/* Create Sprint Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-extrabold text-slate-900">New Sprint</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSprint} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sprint Name</label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Sprint 32"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                  <input type="date" value={formStart} onChange={e => setFormStart(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">End Date</label>
                  <input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Base Points Per Person</label>
                <input type="number" min={1} value={formBase} onChange={e => setFormBase(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <Button disabled={creating} type="submit" className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {creating ? "Creating..." : "Create Sprint"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Sprint Cards */}
      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        {sprints.length === 0 && (
          <div className="col-span-2 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <Zap className="mx-auto h-10 w-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-400">No sprints yet</p>
            <p className="text-xs text-slate-400 mt-1">Click "New Sprint" to get started.</p>
          </div>
        )}
        {sprints.map(sprint => {
          const active = sprint.status === "active";
          const participantCount = sprint.sprint_participants?.[0]?.count ?? 0;
          return (
            <button
              key={sprint.id}
              onClick={() => startTransition(() => router.push(`/sprints/${sprint.id}`))}
              className={cn(
                "w-full text-left rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 relative group",
                active ? "border-violet-200 bg-violet-50/30" : "border-slate-100 bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2.5 w-2.5 rounded-full", active ? "bg-green-500 animate-pulse" : "bg-slate-300")} />
                  <span className={cn("text-[11px] font-bold uppercase tracking-wide", active ? "text-green-600" : "text-slate-400")}>
                    {active ? "In Progress" : "Completed"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isPending && <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSprint(sprint.id, sprint.name);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mb-2">{sprint.name}</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(sprint.start_date)} – {formatDate(sprint.end_date)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {participantCount} {participantCount === 1 ? "person" : "people"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Projects Management */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Projects</h2>
          <Button size="sm" variant="outline" onClick={() => setShowProjectForm(v => !v)} className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" />
            Add Project
          </Button>
        </div>
        {showProjectForm && (
          <form onSubmit={handleAddProject} className="flex gap-2 mb-4">
            <input
              autoFocus
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              placeholder="Project name..."
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
            <Button type="submit" size="sm" className="bg-violet-600 text-white hover:bg-violet-700">Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowProjectForm(false); setNewProjectName(""); }}>Cancel</Button>
          </form>
        )}
        {projects.length === 0 ? (
          <p className="text-sm text-slate-400">No projects yet. Add one to track allocations.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {projects.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-100 px-3 py-1.5 text-sm font-medium text-violet-700">
                {p.name}
                <button onClick={() => handleDeleteProject(p.id)} className="text-violet-400 hover:text-violet-700 ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
