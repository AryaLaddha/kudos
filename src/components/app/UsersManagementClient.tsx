"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Users,
  Search,
  X,
  AlertCircle,
  Loader2,
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  Mail,
  Shield,
  Copy,
} from "lucide-react";
import { type Profile } from "@/types";
import { setUserActive, setUserAdmin, inviteUser } from "@/app/(app)/admin/users/actions";
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
  const [pendingAdminId, setPendingAdminId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteDept, setInviteDept] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [invitePending, startInviteTransition] = useTransition();
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [setupLink, setSetupLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  function handleToggleAdmin(user: UserRow) {
    const newValue = !user.is_admin;

    setPendingAdminId(user.id);
    startTransition(async () => {
      const result = await setUserAdmin(user.id, newValue);
      if (result.error) {
        setError(result.error);
      } else {
        setUsers(prev =>
          prev.map(u => u.id === user.id ? { ...u, is_admin: newValue } : u)
        );
      }
      setPendingAdminId(null);
    });
  }

  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  }

  function closeInviteModal() {
    setShowInvite(false);
    setInviteEmail("");
    setInviteName("");
    setInviteDept("");
    setInviteRole("");
    setInviteError(null);
    setInviteSuccess(false);
    setSetupLink(null);
    setCopied(false);
  }

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    startInviteTransition(async () => {
      const result = await inviteUser({
        email: inviteEmail.trim(),
        full_name: inviteName.trim() || undefined,
        department: inviteDept.trim() || undefined,
        job_title: inviteRole.trim() || undefined,
      });
      if (result.error) {
        setInviteError(result.error);
      } else {
        setInviteSuccess(true);
        if (result.setupLink) {
          setSetupLink(result.setupLink);
        }
        // Optimistically append so the admin sees the new row immediately
        const placeholder: UserRow = {
          id: `pending-${Date.now()}`,
          org_id: null,
          full_name: inviteName.trim() || inviteEmail.trim(),
          avatar_url: null,
          department: inviteDept.trim() || null,
          job_title: inviteRole.trim() || null,
          monthly_allowance: 50,
          points_balance: 0,
          is_admin: false,
          is_active: false,
          created_at: new Date().toISOString(),
          email: inviteEmail.trim(),
        };
        setUsers(prev => [...prev, placeholder]);
        
        // If there's NO link, we auto-close. If there's a link, we stay open so they can copy it.
        if (!result.setupLink) {
          setTimeout(closeInviteModal, 1800);
        }
      }
    });
  }

  function handleCopyLink() {
    if (!setupLink) return;
    navigator.clipboard.writeText(setupLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          {/* Add User button */}
          <button
            id="add-user-btn"
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-bold shadow-sm transition-all duration-150"
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </button>
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
              const loadingActive = isPending && pendingId === user.id;
              const loadingAdmin = isPending && pendingAdminId === user.id;

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

                  {/* Controls */}
                  <div className="flex-shrink-0 flex items-center gap-4">

                    {/* Admin toggle */}
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        disabled={loadingAdmin || isSelf}
                        title={
                          isSelf
                            ? "You cannot remove your own admin access"
                            : user.is_admin
                            ? "Revoke admin access"
                            : "Grant admin access"
                        }
                        className={cn(
                          "flex items-center justify-center h-8 w-8 rounded-xl border-2 transition-all duration-200 focus:outline-none",
                          user.is_admin
                            ? "bg-violet-100 border-violet-300 text-violet-600 hover:bg-violet-200"
                            : "bg-slate-50 border-slate-200 text-slate-300 hover:bg-slate-100 hover:text-slate-400",
                          (loadingAdmin || isSelf) && "opacity-40 cursor-not-allowed",
                          !isSelf && "cursor-pointer"
                        )}
                      >
                        {loadingAdmin ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Shield className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Admin
                      </span>
                    </div>

                    {/* Active toggle */}
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={loadingActive || isSelf}
                        title={isSelf ? "You cannot deactivate your own account" : undefined}
                        className={cn(
                          "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                          isActive ? "bg-emerald-500" : "bg-slate-300",
                          (loadingActive || isSelf) && "opacity-50 cursor-not-allowed",
                          !isSelf && "cursor-pointer"
                        )}
                      >
                        {loadingActive ? (
                          <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 text-white animate-spin" />
                        ) : (
                          <span className={cn(
                            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out",
                            isActive ? "translate-x-5" : "translate-x-0"
                          )} />
                        )}
                      </button>
                      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

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

      {/* ── Invite Modal ─────────────────────────────────────────── */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeInviteModal(); }}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            style={{ animation: "slideUp 0.22s cubic-bezier(.22,1,.36,1)" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50">
                  <UserPlus className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Add User</h2>
                  <p className="text-xs text-slate-400 font-medium">They&apos;ll get an email to set their password</p>
                </div>
              </div>
              <button
                onClick={closeInviteModal}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-7 py-6">
              {inviteSuccess ? (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div className="p-4 rounded-full bg-emerald-50">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                  <div className="w-full">
                    <p className="font-black text-slate-900 text-lg">Account created!</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {setupLink ? "The account is ready. Send this setup link to:" : "A password-setup email has been sent to"}
                    </p>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">{inviteEmail}</p>

                    {setupLink && (
                      <div className="mt-6 space-y-3">
                        <div className="relative group">
                          <input
                            readOnly
                            value={setupLink}
                            className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-500 outline-none"
                          />
                          <button
                            onClick={handleCopyLink}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 shadow-sm transition-all"
                          >
                            {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                        <button
                          onClick={handleCopyLink}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-indigo-100 shadow-lg hover:bg-indigo-700 transition-all"
                        >
                          {copied ? "Copied Link!" : "Copy Setup Link"}
                        </button>
                        <p className="text-[10px] text-slate-400 font-medium">
                          This is a one-time secure link. Send it to the user so they can set their password.
                        </p>
                      </div>
                    )}

                    {!setupLink && (
                      <p className="text-xs text-slate-400 mt-6 pt-6 border-t border-slate-50">
                        They can also use <span className="font-semibold text-slate-600 underline">Forgot password</span> on the login page at any time.
                      </p>
                    )}
                  </div>
                  
                  {setupLink && (
                    <button
                      onClick={closeInviteModal}
                      className="mt-4 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Done
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleInviteSubmit} className="space-y-4">
                  {inviteError && (
                    <div className="flex items-start gap-3 p-3.5 bg-red-50 text-red-700 rounded-2xl border border-red-100">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p className="text-xs font-bold">{inviteError}</p>
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wide">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        id="invite-email"
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-medium text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wide">Full Name</label>
                    <input
                      id="invite-name"
                      type="text"
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-medium text-slate-900"
                    />
                  </div>

                  {/* Department + Job Title */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wide">Department</label>
                      <input
                        id="invite-dept"
                        type="text"
                        value={inviteDept}
                        onChange={e => setInviteDept(e.target.value)}
                        placeholder="Engineering"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-medium text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wide">Job Title</label>
                      <input
                        id="invite-role"
                        type="text"
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value)}
                        placeholder="Software Engineer"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm font-medium text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Info note */}
                  <div className="flex items-start gap-2.5 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <Mail className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-600 font-medium leading-relaxed">
                      The user will receive an email with a link to set their password. Their login email will be the address you entered above.
                    </p>
                  </div>

                  {/* Submit */}
                  <button
                    id="invite-submit-btn"
                    type="submit"
                    disabled={invitePending}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-sm shadow-sm transition-all duration-150"
                  >
                    {invitePending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
                    ) : (
                      <><UserPlus className="h-4 w-4" /> Create Account</>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
      `}</style>
    </div>
  );
}
