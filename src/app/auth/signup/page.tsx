"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      setDone(true);
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
              <Sparkles className="h-7 w-7 text-indigo-600" />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Check your inbox</h2>
          <p className="text-slate-500 text-sm">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account and start recognising your team.
          </p>
          <Link href="/auth/login" className="mt-6 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Back to sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-slate-900 p-12 lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Kudos</span>
        </Link>
        <div className="space-y-6">
          {[
            { emoji: "🚀", text: "Ship the new API endpoint. Couldn't have done it without you!", from: "Taylor → Alex", pts: "+30 pts" },
            { emoji: "❤️", text: "Always the first to help when things get chaotic. Legendary.", from: "Jordan → Sam", pts: "+20 pts" },
            { emoji: "🏆", text: "The client presentation was perfect. You absolutely nailed it.", from: "Morgan → Riley", pts: "+40 pts" },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/80 text-sm mb-2">{item.emoji} {item.text}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">{item.from}</span>
                <span className="text-xs font-bold text-indigo-400">{item.pts}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-white/30 text-xs">Join 2,000+ teams building recognition-first cultures.</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-slate-900">Kudos</span>
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-900">Create your account</h1>
            <p className="mt-1 text-sm text-slate-500">Free for teams up to 10 people</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Full name</Label>
              <Input
                id="name"
                type="text"
                required
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 h-11 border-slate-200"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11 border-slate-200"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 border-slate-200 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            By signing up you agree to our{" "}
            <span className="text-slate-600 underline cursor-pointer">Terms</span> and{" "}
            <span className="text-slate-600 underline cursor-pointer">Privacy Policy</span>.
          </p>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
