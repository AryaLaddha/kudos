"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Eye, EyeOff, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.push("/feed"), 2500);
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-[360px]">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mb-10">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">Kudos</span>
        </Link>

        {done ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className="text-[24px] font-extrabold text-slate-900 mb-2">Password updated!</h1>
            <p className="text-[15px] text-slate-500">Redirecting you to the app…</p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-[28px] font-extrabold leading-tight text-slate-900">
                Set new password
              </h1>
              <p className="mt-1.5 text-[15px] text-slate-500">
                Choose a strong password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New password */}
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
                  New password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Confirm password */}
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  placeholder=" "
                  className={cn(
                    "peer w-full rounded-xl border bg-slate-50/50 px-4 pb-2.5 pt-6 pr-12 text-sm text-slate-900 outline-none transition-all",
                    (confirmFocused || confirm)
                      ? "border-indigo-400 ring-2 ring-indigo-100 bg-white"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                />
                <label
                  htmlFor="confirm"
                  className={cn(
                    "pointer-events-none absolute left-4 font-medium transition-all duration-150",
                    (confirmFocused || confirm)
                      ? "top-2 text-[10px] uppercase tracking-wider text-indigo-500"
                      : "top-1/2 -translate-y-1/2 text-sm text-slate-400"
                  )}
                >
                  Confirm password
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {error && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  "h-12 w-full rounded-xl text-[15px] font-semibold text-white transition-all",
                  loading
                    ? "bg-indigo-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-200 active:translate-y-0"
                )}
              >
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
