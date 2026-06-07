"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Stream } from "@/types";

const MAX_STREAM_NAME = 40;

// Streams are an admin-managed catalogue. All mutations are admin-only.
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("is_admin, org_id").eq("id", user.id).single();
  if (!profile?.is_admin) throw new Error("Forbidden");
  return { supabase, orgId: profile.org_id as string };
}

export async function getStreams(): Promise<Stream[]> {
  const { supabase, orgId } = await requireAdmin();
  const { data } = await supabase
    .from("streams")
    .select("id, name, is_archived")
    .eq("org_id", orgId)
    .order("name");
  return (data as Stream[]) ?? [];
}

export async function createStream(name: string): Promise<{ error?: string; stream?: Stream }> {
  const { supabase, orgId } = await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Stream name is required." };
  if (trimmed.length > MAX_STREAM_NAME) return { error: `Name must be ${MAX_STREAM_NAME} characters or fewer.` };
  const { data, error } = await supabase
    .from("streams")
    .insert({ name: trimmed, org_id: orgId })
    .select("id, name, is_archived")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin/streams");
  return { stream: data as Stream };
}

// No delete by design — streams are archived (and can be restored), never removed.
export async function setStreamArchived(id: string, archived: boolean): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("streams").update({ is_archived: archived }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/streams");
  return {};
}
