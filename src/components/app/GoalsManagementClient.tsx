"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search
} from "lucide-react";
import { type GoalDefinition } from "@/types";
import {
  addGoalDefinition,
  updateGoalDefinition,
  deleteGoalDefinition
} from "@/app/(app)/admin/goals/actions";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  initialGoals: GoalDefinition[];
}

const CATEGORY_COLORS = [
  { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100", header: "bg-violet-50/60" },
  { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", header: "bg-emerald-50/60" },
  { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100", header: "bg-amber-50/60" },
  { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100", header: "bg-blue-50/60" },
  { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100", header: "bg-rose-50/60" },
  { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100", header: "bg-indigo-50/60" },
  { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-100", header: "bg-teal-50/60" },
  { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100", header: "bg-orange-50/60" },
];

function getCategoryColor(category: string, categories: string[]) {
  const idx = categories.indexOf(category);
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
}

export default function GoalsManagementClient({ initialGoals }: Props) {
  const [goals, setGoals] = useState<GoalDefinition[]>(initialGoals);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [isNewCategory, setIsNewCategory] = useState(false);

  // Derive categories dynamically from goals
  const categories = useMemo(() => {
    const cats = [...new Set(goals.map(g => g.category))].sort();
    return cats;
  }, [goals]);

  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(initialGoals.map(g => g.category))
  );

  // Form states
  const [formData, setFormData] = useState({
    title: "",
    points: 10,
    category: categories[0] ?? ""
  });

  const searchLower = search.toLowerCase().trim();

  const goalsByCategory = useMemo(() => {
    const map: Record<string, GoalDefinition[]> = {};
    for (const goal of goals) {
      if (searchLower && !goal.title.toLowerCase().includes(searchLower) && !goal.category.toLowerCase().includes(searchLower)) continue;
      if (!map[goal.category]) map[goal.category] = [];
      map[goal.category].push(goal);
    }
    return map;
  }, [goals, searchLower]);

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const getEffectiveCategory = () => {
    if (isNewCategory) return newCategoryInput.trim();
    return formData.category;
  };

  const handleAdd = async () => {
    const category = getEffectiveCategory();
    if (!formData.title) return setError("Title is required");
    if (!category) return setError("Category is required");

    startTransition(async () => {
      const result = await addGoalDefinition({ ...formData, category });
      if (result.error) {
        setError(result.error);
      } else {
        const newGoal: GoalDefinition = {
          id: result.id!,
          title: formData.title,
          points: formData.points,
          category,
          org_id: "",
          created_at: new Date().toISOString(),
        };
        setGoals(prev => [...prev, newGoal]);
        setOpenCategories(prev => new Set([...prev, category]));
        setIsAdding(false);
        setIsNewCategory(false);
        setNewCategoryInput("");
        setFormData({ title: "", points: 10, category: categories[0] ?? "" });
        setError(null);
      }
    });
  };

  const handleUpdate = async (id: string) => {
    const category = getEffectiveCategory();
    if (!formData.title) return setError("Title is required");
    if (!category) return setError("Category is required");

    startTransition(async () => {
      const result = await updateGoalDefinition(id, { ...formData, category });
      if (result.error) {
        setError(result.error);
      } else {
        setGoals(prev => prev.map(g => g.id === id ? { ...g, ...formData, category } : g));
        setEditingId(null);
        setIsNewCategory(false);
        setNewCategoryInput("");
        setError(null);
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this goal? This cannot be undone.")) return;

    startTransition(async () => {
      const result = await deleteGoalDefinition(id);
      if (result.error) {
        setError(result.error);
      } else {
        setGoals(prev => prev.filter(g => g.id !== id));
      }
    });
  };

  const startEditing = (goal: GoalDefinition) => {
    setEditingId(goal.id);
    setIsAdding(false);
    setIsNewCategory(false);
    setNewCategoryInput("");
    setFormData({
      title: goal.title,
      points: goal.points,
      category: goal.category
    });
  };

  const openAddForm = () => {
    setIsAdding(true);
    setEditingId(null);
    setIsNewCategory(false);
    setNewCategoryInput("");
    setFormData({ title: "", points: 10, category: categories[0] ?? "" });
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setIsNewCategory(false);
    setNewCategoryInput("");
  };

  const allCategories = useMemo(() => {
    const existing = [...new Set(goals.map(g => g.category))].sort();
    return existing;
  }, [goals]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Target className="h-8 w-8 text-indigo-600" />
            Goals Management
          </h1>
          <p className="text-slate-500 mt-1 font-medium italic">Define what success looks like for your organization</p>
        </div>

        <button
          onClick={openAddForm}
          disabled={isPending || isAdding}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New Goal
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search goals or categories…"
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-900 shadow-sm"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-bold">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAdding || editingId !== null} onOpenChange={(open) => { if (!open) cancelForm(); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-2xl p-0 overflow-hidden">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl">
                  {editingId ? <Pencil className="h-5 w-5 text-indigo-600" /> : <Plus className="h-5 w-5 text-indigo-600" />}
                </div>
                <DialogTitle className="text-xl font-black text-slate-900">
                  {editingId ? "Edit Goal" : "Create New Goal"}
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-12 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Goal Title</label>
                <textarea
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Complete a new certification"
                  rows={3}
                  className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-900 resize-none"
                />
              </div>

              <div className="md:col-span-8 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
                {!isNewCategory ? (
                  <div className="flex gap-2">
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="flex-1 px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                    >
                      {allCategories.length === 0 && (
                        <option value="">— no categories yet —</option>
                      )}
                      {allCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setIsNewCategory(true); setNewCategoryInput(""); }}
                      className="flex items-center gap-1.5 px-4 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all whitespace-nowrap text-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New category
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryInput}
                      onChange={e => setNewCategoryInput(e.target.value)}
                      placeholder="e.g. Leadership & Mentoring"
                      autoFocus
                      className="flex-1 px-5 py-3.5 rounded-2xl bg-slate-50 border border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-900"
                    />
                    {allCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setIsNewCategory(false); setNewCategoryInput(""); }}
                        className="px-4 py-3.5 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="md:col-span-4 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Points</label>
                <input
                  type="number"
                  value={formData.points}
                  onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                  className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-100 bg-slate-50/60">
            <button
              onClick={cancelForm}
              className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => editingId ? handleUpdate(editingId) : handleAdd()}
              disabled={isPending}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingId ? "Update Goal" : "Create Goal"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Goals List — accordion by category */}
      {goals.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-[2.5rem] px-8 py-20 text-center shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-slate-50 rounded-full">
              <Target className="h-8 w-8 text-slate-300" />
            </div>
            <div>
              <p className="text-slate-500 font-bold">No goals defined yet.</p>
              <p className="text-sm text-slate-400 mt-1">Click "New Goal" to create your first goal.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.filter(cat => goalsByCategory[cat]?.length > 0).length === 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl px-8 py-12 text-center">
              <p className="text-slate-500 font-bold">No goals match "{search}"</p>
            </div>
          )}
          {categories.filter(cat => goalsByCategory[cat]?.length > 0).map(cat => {
            const color = getCategoryColor(cat, categories);
            const catGoals = goalsByCategory[cat] ?? [];
            const isOpen = openCategories.has(cat);

            return (
              <div key={cat} className={cn("border rounded-2xl overflow-hidden transition-all", color.border)}>
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    "w-full flex items-center justify-between px-6 py-4 text-left transition-colors hover:brightness-95",
                    color.header
                  )}
                >
                  <div className="flex items-center gap-3">
                    {isOpen
                      ? <ChevronDown className={cn("h-4 w-4", color.text)} />
                      : <ChevronRight className={cn("h-4 w-4", color.text)} />
                    }
                    <span className={cn("text-sm font-black uppercase tracking-wider", color.text)}>{cat}</span>
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", color.bg, color.text)}>
                      {catGoals.length} {catGoals.length === 1 ? "goal" : "goals"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    {catGoals.reduce((sum, g) => sum + g.points, 0)} pts total
                  </div>
                </button>

                {/* Goals rows */}
                {isOpen && (
                  <div className="bg-white divide-y divide-slate-50">
                    {catGoals.map(goal => (
                      <div
                        key={goal.id}
                        className={cn(
                          "flex items-center gap-4 px-6 py-4 transition-colors",
                          editingId === goal.id ? "bg-indigo-50/30" : "hover:bg-slate-50/60"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 leading-relaxed">{goal.title}</p>
                        </div>
                        <span className="text-base font-black text-indigo-600 whitespace-nowrap shrink-0">
                          {goal.points} pts
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEditing(goal)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(goal.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-6 flex items-center gap-3 px-2 text-slate-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <p className="text-xs font-medium">Changes to goals are immediate and will affect new achievement logs. Past logs will retain their original titles/points for data integrity.</p>
      </div>
    </div>
  );
}
