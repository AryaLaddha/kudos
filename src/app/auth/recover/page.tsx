"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function RecoverPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // On the client, Supabase's JS SDK will automatically parse the #access_token
    // from the URL fragment and establish the local session.
    const initializeRecovery = async () => {
      try {
        const supabase = createClient();
        
        // Let the SDK process the hash fragment
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setError(error.message);
          return;
        }

        if (session) {
          // Success! They are authenticated. Send them to reset password.
          router.push("/auth/reset-password");
        } else {
          // If no session but there's a hash, maybe it needs a moment
          // Or maybe the token was already consumed.
          const hash = window.location.hash;
          if (hash && hash.includes("error_code=otp_expired")) {
            setError("This recovery link has expired or has already been used. Please ask your admin for a new link.");
          } else if (!hash) {
             setError("No recovery token found in the URL.");
          }
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred.");
      }
    };

    initializeRecovery();
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
