"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function RecoverPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // 1. Immediately check if there is a flat-out error in the hash
    const hash = window.location.hash;
    if (hash && hash.includes("error_code=otp_expired")) {
      setError("This recovery link has expired or has already been used. Please ask your admin for a new link.");
      return;
    }

    // Modern Supabase SSR strictly expects PKCE (?code=) and often ignores
    // implicit flow hash fragments. We manually parse the hash and set the session!
    if (hash && hash.includes("access_token=")) {
      const params = new URLSearchParams(hash.substring(1)); // Remove the '#'
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ error }) => {
          if (!error) {
            router.push("/auth/reset-password");
          } else {
            setError(error.message);
          }
        });
        return; // Success or explicit failure, don't wait for timeout
      }
    }

    // Fallback: Check if Supabase used PKCE flow instead of Implicit flow
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          router.push("/auth/reset-password");
        } else {
          setError(error.message);
        }
      });
      return; // Skip the rest if we have a PKCE code
    }

    // 3. Fallback timeout if the token is utterly unparseable
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
         setError("Recovery failed. No valid access token or PKCE code was found in the URL.");
      } else {
         router.push("/auth/reset-password");
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 text-center flex flex-col items-center">
        {error ? (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 font-bold text-xl">!</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Recovery Failed</h1>
            <p className="text-sm text-slate-500 mb-2">{error}</p>
            <div className="text-[10px] text-left w-full bg-slate-100 p-3 rounded text-slate-600 font-mono break-all mb-6">
              <b>Debug Info:</b><br />
              URL: {typeof window !== 'undefined' ? window.location.href : 'SSR'}<br />
              Hash: {typeof window !== 'undefined' && window.location.hash ? window.location.hash.substring(0, 40) + '...' : 'none'}<br />
            </div>
            <button
              onClick={() => router.push("/auth/login")}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800"
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Authenticating...</h1>
            <p className="text-sm text-slate-500">Securing your session, please wait.</p>
          </>
        )}
      </div>
    </div>
  );
}
