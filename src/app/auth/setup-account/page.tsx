"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { KeyRound } from "lucide-react";
import { BrandMark } from "@/components/app/BrandMark";

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
      const base64 = t!.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
      const url = new URL(atob(padded), window.location.origin);
      if (url.origin !== window.location.origin) throw new Error("Invalid setup link origin");
      window.location.href = url.toString();
    } catch {
      router.replace("/auth/login");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="flex flex-col items-center px-8 py-10 text-center">
          <div className="mb-6">
            <BrandMark className="text-3xl" endorsed />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Welcome to Kudos</h1>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            Your account is ready. Click below to set your password and get started.
          </p>
          <button
            onClick={handleSetup}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-action hover:bg-action-hover active:bg-action-hover text-white font-black text-sm shadow-lg shadow-action/20 transition-all"
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
