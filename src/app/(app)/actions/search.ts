"use server";

import { createClient } from "@/lib/supabase/server";

export async function searchGlobal(query: string) {
  const supabase = await createClient();
  const cleanQuery = query.trim();

  if (!cleanQuery) return { users: [], posts: [] };

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, job_title")
    .ilike("full_name", `%${cleanQuery}%`)
    .limit(10);

  return { users: users || [], posts: [] };
}
