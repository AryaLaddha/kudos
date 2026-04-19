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

    // 2. Listen for the SDK to parse the hash fragment securely
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          // The SDK successfully consumed the token in the URL!
          router.push("/auth/reset-password");
        } else if (event === "USER_UPDATED") {
          router.push("/auth/reset-password");
        }
      }
    );

    // 3. Fallback: If after 3 seconds the auth state hasn't changed
    // and there's no session, it means the URL was likely completely invalid.
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
         setError("Recovery failed. Ensure you copied the exact link and that it hasn't expired.");
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 text-center flex flex-col items-center">
        {error ? (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 font-bold text-xl">!</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Recovery Failed</h1>
            <p className="text-sm text-slate-500 mb-6">{error}</p>
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
