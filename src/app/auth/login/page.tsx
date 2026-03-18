"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Eye, EyeOff, ArrowRight, Heart, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RECENT_KUDOS = [
  {
    from: "Alex M.",
    to: "Jordan P.",
    msg: "Shipped the new onboarding flawlessly. Absolute legend. 🚀",
    pts: 50,
    fromColor: "bg-violet-500",
    toColor: "bg-sky-500",
  },
  {
    from: "Priya S.",
    to: "Sam T.",
    msg: "Stayed late to fix the prod outage. You saved us. ❤️",
    pts: 30,
    fromColor: "bg-rose-500",
    toColor: "bg-amber-500",
  },
  {
    from: "Riley K.",
    to: "Morgan J.",
    msg: "The client presentation was perfect. Nailed it. 🎉",
    pts: 40,
    fromColor: "bg-emerald-500",
    toColor: "bg-indigo-500",
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Invalid email or password.");
    } else {
      toast.success("Welcome back! 👋");
      router.refresh();
      router.push("/feed");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* ── Left panel: animated dark gradient ── */}
      <div className="relative hidden w-[52%] overflow-hidden lg:flex flex-col justify-between p-12"
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4338ca 60%, #6366f1 100%)",
        }}
      >
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-300/10 blur-2xl" />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Kudos</span>
        </Link>

        {/* Live feed preview */}
        <div className="relative z-10 flex flex-col gap-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            <span className="text-xs font-medium text-white/50 uppercase tracking-widest">Live recognition feed</span>
          </div>

          {RECENT_KUDOS.map((k, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={cn("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white", k.fromColor)}>
                    {k.from[0]}
                  </span>
                  <span className="text-xs text-white/40">→</span>
                  <span className={cn("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white", k.toColor)}>
                    {k.to[0]}
                  </span>
                  <p className="text-xs text-white/70 truncate ml-1">{k.msg}</p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/80">
                  +{k.pts}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { icon: Heart, value: "2,400+", label: "Kudos sent today" },
            { icon: Zap, value: "98%", label: "Engagement rate" },
            { icon: Star, value: "4.9★", label: "Avg. satisfaction" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/8 px-3 py-3 text-center backdrop-blur-sm">
              <Icon className="mx-auto mb-1 h-3.5 w-3.5 text-white/40" />
              <p className="text-base font-extrabold text-white">{value}</p>
              <p className="text-[10px] text-white/40 leading-tight mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">Kudos</span>
          </Link>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[28px] font-extrabold leading-tight text-slate-900">
              Welcome back
            </h1>
            <p className="mt-1.5 text-[15px] text-slate-500">
              Sign in to recognise your team
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email floating label */}
            <div className="relative">
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder=" "
                className={cn(
                  "peer w-full rounded-xl border bg-slate-50/50 px-4 pb-2.5 pt-6 text-sm text-slate-900 outline-none transition-all",
                  (emailFocused || email)
                    ? "border-indigo-400 ring-2 ring-indigo-100 bg-white"
                    : "border-slate-200 hover:border-slate-300"
                )}
              />
              <label
                htmlFor="email"
                className={cn(
                  "pointer-events-none absolute left-4 font-medium transition-all duration-150",
                  (emailFocused || email)
                    ? "top-2 text-[10px] uppercase tracking-wider text-indigo-500"
                    : "top-1/2 -translate-y-1/2 text-sm text-slate-400"
                )}
              >
                Email address
              </label>
            </div>

            {/* Password floating label */}
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder=" "
                className={cn(
                  "peer w-full rounded-xl border bg-slate-50/50 px-4 pb-2.5 pt-6 pr-12 text-sm text-slate-900 outline-none transition-all",
                  (passwordFocused || password)
                    ? "border-indigo-400 ring-2 ring-indigo-100 bg-white"
                    : "border-slate-200 hover:border-slate-300"
                )}
              />
              <label
                htmlFor="password"
                className={cn(
                  "pointer-events-none absolute left-4 font-medium transition-all duration-150",
                  (passwordFocused || password)
                    ? "top-2 text-[10px] uppercase tracking-wider text-indigo-500"
                    : "top-1/2 -translate-y-1/2 text-sm text-slate-400"
                )}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end -mt-1">
              <Link
                href="/auth/forgot-password"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className={cn(
                "relative h-12 w-full rounded-xl text-[15px] font-semibold text-white transition-all",
                loading
                  ? "bg-indigo-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-200 active:translate-y-0"
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  Sign in <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
