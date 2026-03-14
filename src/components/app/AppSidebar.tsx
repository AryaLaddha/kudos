"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, LayoutDashboard, User, LogOut, Heart, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/feed", label: "Feed", icon: LayoutDashboard },
  { href: "/give", label: "Give Kudos", icon: Heart },
];

interface Props {
  user: SupabaseUser;
  profile: Profile | null;
}

export default function AppSidebar({ user, profile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const displayName = profile?.full_name || user.email?.split("@")[0] || "You";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-100 bg-white sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-bold text-slate-900">Kudos</span>
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
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("h-4 w-4", active ? "text-indigo-600" : "text-slate-400")} />
              {item.label}
            </Link>
          );
        })}
        <Separator className="my-2" />
        <Link
          href={`/profile/${user.id}`}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/profile")
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <User className={cn("h-4 w-4", pathname.startsWith("/profile") ? "text-indigo-600" : "text-slate-400")} />
          My Profile
        </Link>
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
          <button onClick={handleSignOut} className="text-slate-400 hover:text-slate-600 transition-colors" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
