"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Users,
  Search,
  X,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { type Profile } from "@/types";
import { setUserActive } from "@/app/(app)/admin/users/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type UserRow = Profile & { email: string };

interface Props {
  initialUsers: UserRow[];
  currentUserId: string;
}

export default function UsersManagementClient({ initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchLower = search.toLowerCase().trim();
  const filtered = useMemo(() => {
    if (!searchLower) return users;
    return users.filter(
      u =>
        u.full_name.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        (u.department ?? "").toLowerCase().includes(searchLower) ||
        (u.job_title ?? "").toLowerCase().includes(searchLower)
    );
  }, [users, searchLower]);

  const activeCount = users.filter(u => u.is_active !== false).length;
  const inactiveCount = users.length - activeCount;

  function handleToggleActive(user: UserRow) {
    const newValue = user.is_active === false ? true : false;

    // Prevent deactivating yourself
    if (user.id === currentUserId && !newValue) {
      setError("You cannot deactivate your own account.");
      return;
    }

    setPendingId(user.id);
    startTransition(async () => {
      const result = await setUserActive(user.id, newValue);
      if (result.error) {
        setError(result.error);
      } else {
        setUsers(prev =>
          prev.map(u => u.id === user.id ? { ...u, is_active: newValue } : u)
        );
      }
      setPendingId(null);
    });
  }

  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-600" />
            User Management
          </h1>
          <p className="text-slate-500 mt-1 font-medium italic">Manage who has access to your organisation</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-emerald-700">{activeCount} active</span>
          </div>
          {inactiveCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 border border-slate-200">
              <div className="h-2 w-2 rounded-full bg-slate-400" />
              <span className="text-sm font-bold text-slate-600">{inactiveCount} inactive</span>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, department or role…"
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-900 shadow-sm"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-bold">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* User list */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-8 py-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-slate-50 rounded-full">
                <Users className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-bold">
                {search ? `No users match "${search}"` : "No users found."}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(user => {
              const isActive = user.is_active !== false;
              const isSelf = user.id === currentUserId;
              const loading = isPending && pendingId === user.id;

              return (
                <div
                  key={user.id}
                  className={cn(
                    "flex items-center gap-4 px-6 py-4 transition-colors",
                    !isActive && "bg-slate-50/60 opacity-60"
                  )}
                >
                  {/* Avatar */}
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={user.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm font-bold">
                      {getInitials(user.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name / meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 truncate">{user.full_name || "—"}</p>
                      {user.is_admin && (
                        <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-600">
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </span>
                      )}
                      {isSelf && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-indigo-500">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
                    {(user.job_title || user.department) && (
                      <p className="text-xs text-slate-400 truncate">
                        {[user.job_title, user.department].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>

                  {/* Points */}
                  <div className="hidden sm:block text-right flex-shrink-0">
                    <p className="text-sm font-black text-indigo-600">{user.points_balance ?? 0} pts</p>
                    <p className="text-[10px] text-slate-400 font-medium">balance</p>
                  </div>

                  {/* Active toggle */}
                  <div className="flex-shrink-0 flex items-center gap-3">
                    <span className={cn(
                      "text-xs font-bold",
                      isActive ? "text-emerald-600" : "text-slate-400"
                    )}>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() => handleToggleActive(user)}
                      disabled={loading || isSelf}
                      title={isSelf ? "You cannot deactivate your own account" : undefined}
                      className={cn(
                        "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                        isActive ? "bg-emerald-500" : "bg-slate-300",
                        (loading || isSelf) && "opacity-50 cursor-not-allowed",
                        !isSelf && "cursor-pointer"
                      )}
                    >
                      {loading ? (
                        <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 text-white animate-spin" />
                      ) : (
                        <span className={cn(
                          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out",
                          isActive ? "translate-x-5" : "translate-x-0"
                        )} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3 px-2 text-slate-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <p className="text-xs font-medium">Inactive users are immediately signed out and cannot log back in until reactivated.</p>
      </div>
    </div>
  );
}
