"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
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

        {sent ? (
          /* ── Success state ── */
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100">
              <Mail className="h-6 w-6 text-indigo-600" />
            </div>
            <h1 className="text-[24px] font-extrabold text-slate-900 mb-2">Check your email</h1>
            <p className="text-[15px] text-slate-500 mb-6">
              We sent a password reset link to{" "}
              <span className="font-semibold text-slate-700">{email}</span>
            </p>
            <p className="text-xs text-slate-400 mb-8">
              Didn't get it? Check your spam folder or{" "}
              <button
                onClick={() => setSent(false)}
                className="text-indigo-600 underline decoration-dotted hover:text-indigo-700"
              >
                try again
              </button>
              .
            </p>
            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <div className="mb-8">
              <h1 className="text-[28px] font-extrabold leading-tight text-slate-900">
                Forgot password?
              </h1>
              <p className="mt-1.5 text-[15px] text-slate-500">
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>

            <Link
              href="/auth/login"
              className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
