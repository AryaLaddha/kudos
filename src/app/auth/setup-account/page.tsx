"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { KeyRound, Sparkles } from "lucide-react";

function SetupAccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = searchParams.get("t");

  if (!t) {
    router.replace("/auth/login");
    return null;
  }

  function handleSetup() {
    try {
      const url = atob(t!);
      window.location.href = url;
    } catch {
      router.replace("/auth/login");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="flex flex-col items-center px-8 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 mb-6 shadow-lg shadow-indigo-200">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Welcome to Kudos</h1>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            Your account is ready. Click below to set your password and get started.
          </p>
          <button
            onClick={handleSetup}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-sm shadow-lg shadow-indigo-100 transition-all"
          >
            <KeyRound className="h-4 w-4" />
            Set Up My Account
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SetupAccountPage() {
  return (
    <Suspense>
      <SetupAccountContent />
    </Suspense>
  );
}
