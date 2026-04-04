"use server";

import { createClient } from "@/lib/supabase/server";

export async function searchGlobal(query: string) {
  const supabase = await createClient();
  const cleanQuery = query.trim();

  if (!cleanQuery) return { users: [], posts: [] };

  // Resolve caller's org so search is scoped — prevents cross-org data leak
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { users: [], posts: [] };

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!callerProfile?.org_id) return { users: [], posts: [] };

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, job_title")
    .eq("org_id", callerProfile.org_id)
    .ilike("full_name", `%${cleanQuery}%`)
    .limit(10);

  return { users: users || [], posts: [] };
}
