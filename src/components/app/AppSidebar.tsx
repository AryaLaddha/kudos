"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Sparkles, LayoutDashboard, User, LogOut, Heart, Coins, Loader2, Trophy, Target, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/feed", label: "Feed", icon: LayoutDashboard },
  { href: "/give", label: "Give Kudos", icon: Heart },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/goals", label: "Goals", icon: Target },
];

interface Props {
  user: SupabaseUser;
  profile: Profile | null;
}

export default function AppSidebar({ user, profile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleNav(href: string) {
    setMobileOpen(false);
    if (href === pathname) return;
    setPendingHref(href);
    startTransition(() => {
      router.push(href);
    });
  }

  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setMobileOpen(false);
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/");
  }

  const displayName = profile?.full_name || user.email?.split("@")[0] || "You";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      {/* Mobile top header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-3 border-b border-slate-100 bg-white px-4 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-900">Kudos</span>
        </div>
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 flex h-screen w-60 flex-col border-r border-slate-100 bg-white transition-transform duration-200",
      "md:sticky md:top-0 md:translate-x-0",
      mobileOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-bold text-slate-900">Kudos</span>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Points balance */}
      <div className="mx-3 my-3 rounded-xl bg-indigo-50 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Coins className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Your balance</span>
        </div>
        <div className="flex items-end gap-1">
          <span className="text-2xl font-extrabold text-indigo-600">
            {profile?.points_balance ?? 0}
          </span>
          <span className="text-xs text-indigo-400 mb-0.5">pts</span>
        </div>
        <div className="mt-1 text-xs text-indigo-400">
          {profile?.monthly_allowance ?? 100} pts to give this month
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href || pendingHref === item.href;
          const loading = isPending && pendingHref === item.href;
          return (
            <button
              key={item.href}
              onClick={() => handleNav(item.href)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {loading
                ? <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
                : <item.icon className={cn("h-4 w-4", active ? "text-indigo-600" : "text-slate-400")} />
              }
              {item.label}
            </button>
          );
        })}
        <Separator className="my-2" />
        <button
          onClick={() => handleNav(`/profile/${user.id}`)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/profile") || pendingHref?.startsWith("/profile")
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          {isPending && pendingHref?.startsWith("/profile")
            ? <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
            : <User className={cn("h-4 w-4", pathname.startsWith("/profile") ? "text-indigo-600" : "text-slate-400")} />
          }
          My Profile
        </button>
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button onClick={handleSignOut} disabled={signingOut} className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50" title="Sign out">
            {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
