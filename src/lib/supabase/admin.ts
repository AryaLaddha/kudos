import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with the service-role key.
 * ONLY use this in server actions / server components — never expose to the browser.
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
