"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createRole, setRoleArchived } from "@/app/(app)/sprints/goals-actions";
import type { CapacityRoleDefinition } from "@/types";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Plus, UserCog } from "lucide-react";

interface Props {
  roles: CapacityRoleDefinition[];
  setRoles: React.Dispatch<React.SetStateAction<CapacityRoleDefinition[]>>;
}

export default function RolesManagementClient({ roles, setRoles }: Props) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (roles.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("A role with that name already exists.");
      return;
    }
    startTransition(async () => {
      const res = await createRole(trimmed);
      if (res.error || !res.role) { toast.error(res.error ?? "Something went wrong."); return; }
      setRoles((prev) => [...prev, res.role!].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      toast.success("Role created.");
    });
  }

  function handleArchive(role: CapacityRoleDefinition, archived: boolean) {
    setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, is_archived: archived } : r)));
    startTransition(async () => {
      const res = await setRoleArchived(role.id, archived);
      if (res.error) {
        toast.error(res.error);
        setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, is_archived: !archived } : r)));
        return;
      }
      toast.success(archived ? "Role archived." : "Role restored.");
    });
  }

  const active = roles.filter((r) => !r.is_archived);
  const archived = roles.filter((r) => r.is_archived);

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        <UserCog className="h-4 w-4 text-slate-400" />
        <p className="text-sm text-slate-500">Capacity roles are shared org-wide and used for sprint members and goal requirements.</p>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          placeholder="New role name..."
          maxLength={40}
          className="h-9 flex-1 text-sm"
        />
        <Button onClick={handleCreate} disabled={isPending || !name.trim()} className="h-9 gap-1.5 bg-violet-600 text-white hover:bg-violet-700">
          <Plus className="h-4 w-4" /> Add Role
        </Button>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-500">Active ({active.length})</h2>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm font-medium text-slate-400">No active roles. Add one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((role) => (
              <div key={role.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-xs font-black text-violet-600">
                  {role.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="flex-1 text-sm font-medium text-slate-800">{role.name}</span>
                <button
                  onClick={() => handleArchive(role, true)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Archived ({archived.length})</h2>
          <div className="space-y-2">
            {archived.map((role) => (
              <div key={role.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="flex-1 text-sm font-medium text-slate-400 line-through">{role.name}</span>
                <button
                  onClick={() => handleArchive(role, false)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
