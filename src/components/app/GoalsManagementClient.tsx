"use client";

import { useState, useTransition } from "react";
import { 
  Target, 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  X, 
  Loader2, 
  AlertCircle,
  Database,
  ArrowRight
} from "lucide-react";
import { type GoalDefinition } from "@/types";
import { 
  addGoalDefinition, 
  updateGoalDefinition, 
  deleteGoalDefinition,
  seedGoalsForOrg 
} from "@/app/(app)/admin/goals/actions";
import { cn } from "@/lib/utils";

interface Props {
  initialGoals: GoalDefinition[];
}

const CATEGORIES = [
  'Learning & Certification',
  'Sprint Contribution',
  'Productivity & Efficiency',
  'Practice Growth',
  'Collaboration & Quality'
];

export default function GoalsManagementClient({ initialGoals }: Props) {
  const [goals, setGoals] = useState<GoalDefinition[]>(initialGoals);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: "",
    points: 10,
    category: CATEGORIES[0]
  });

  const handleAdd = async () => {
    if (!formData.title) return setError("Title is required");
    
    startTransition(async () => {
      const result = await addGoalDefinition(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setIsAdding(false);
        setFormData({ title: "", points: 10, category: CATEGORIES[0] });
        // Refresh local state (in a real app we'd probably revalidatePath but for UX we can update local)
        setGoals([...goals, { 
          id: result.id!, 
          ...formData, 
          org_id: "", 
          created_at: new Date().toISOString() 
        } as GoalDefinition]);
        setError(null);
      }
    });
  };

  const handleUpdate = async (id: string) => {
    if (!formData.title) return setError("Title is required");
    
    startTransition(async () => {
      const result = await updateGoalDefinition(id, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setEditingId(null);
        setGoals(goals.map(g => g.id === id ? { ...g, ...formData } : g));
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
        setGoals(goals.filter(g => g.id !== id));
      }
    });
  };

  const handleSeed = async () => {
    if (!confirm("This will add the default set of 24 goals. Continue?")) return;
    
    startTransition(async () => {
      const result = await seedGoalsForOrg();
      if (result.error) {
        setError(result.error);
      } else {
        window.location.reload(); // Simplest way to get the new list
      }
    });
  };

  const startEditing = (goal: GoalDefinition) => {
    setEditingId(goal.id);
    setIsAdding(false);
    setFormData({
      title: goal.title,
      points: goal.points,
      category: goal.category
    });
  };

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
        
        <div className="flex items-center gap-3">
          {goals.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              <Database className="h-4 w-4" />
              Seed Defaults
            </button>
          )}
          <button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
              setFormData({ title: "", points: 10, category: CATEGORIES[0] });
            }}
            disabled={isPending || isAdding}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New Goal
          </button>
        </div>
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

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="mb-10 p-8 bg-white border-2 border-indigo-100 rounded-[2.5rem] shadow-xl shadow-indigo-50/50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 rounded-xl">
              {editingId ? <Pencil className="h-5 w-5 text-indigo-600" /> : <Plus className="h-5 w-5 text-indigo-600" />}
            </div>
            <h2 className="text-xl font-black text-slate-900">{editingId ? "Edit Goal" : "Create New Goal"}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-12 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Goal Title</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Complete a new certification"
                className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-900"
              />
            </div>
            
            <div className="md:col-span-8 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
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
          
          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-50">
            <button
              onClick={() => { setIsAdding(false); setEditingId(null); }}
              className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-all font-bold"
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
        </div>
      )}

      {/* Goals List */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Category</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Goal</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Points</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {goals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-slate-50 rounded-full">
                        <Target className="h-8 w-8 text-slate-300" />
                      </div>
                      <div>
                        <p className="text-slate-500 font-bold">No goals defined yet.</p>
                        <p className="text-sm text-slate-400 mt-1">Add your first goal or seed the defaults to get started.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                goals.map((goal) => (
                  <tr key={goal.id} className={cn(
                    "group transition-colors",
                    editingId === goal.id ? "bg-indigo-50/30" : "hover:bg-slate-50/40"
                  )}>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        goal.category === 'Learning & Certification' ? "bg-violet-50 text-violet-600" :
                        goal.category === 'Sprint Contribution' ? "bg-emerald-50 text-emerald-600" :
                        goal.category === 'Productivity & Efficiency' ? "bg-amber-50 text-amber-600" :
                        goal.category === 'Practice Growth' ? "bg-blue-50 text-blue-600" :
                        "bg-rose-50 text-rose-600"
                      )}>
                        {goal.category}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      <p className="text-sm font-bold text-slate-800 leading-relaxed">{goal.title}</p>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <span className="text-base font-black text-indigo-600 whitespace-nowrap">
                        {goal.points} pts
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEditing(goal)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="mt-6 flex items-center gap-3 px-8 text-slate-400">
        <AlertCircle className="h-4 w-4" />
        <p className="text-xs font-medium">Changes to goals are immediate and will affect new achievement logs. Past logs will retain their original titles/points for data integrity.</p>
      </div>
    </div>
  );
}
