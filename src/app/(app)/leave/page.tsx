import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Leave } from "@/types";
import LeaveCalendarClient from "@/components/app/LeaveCalendarClient";

// Pages using cookies() are already dynamic — no need for force-dynamic

export default async function LeavePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) redirect("/feed");

  // The whole org's leave calendar. RLS restricts this to the caller's org.
  const { data: rows } = await supabase
    .from("leaves")
    .select(
      "id, org_id, user_id, leave_type, custom_label, start_date, end_date, created_at, profiles(full_name, avatar_url)",
    )
    .order("start_date", { ascending: true });

  const leaves: Leave[] = (rows ?? []).map((r) => {
    const p = (r as { profiles?: { full_name?: string; avatar_url?: string | null } }).profiles;
    return {
      id: r.id,
      org_id: r.org_id,
      user_id: r.user_id,
      leave_type: r.leave_type,
      custom_label: r.custom_label,
      start_date: r.start_date,
      end_date: r.end_date,
      created_at: r.created_at,
      user_name: p?.full_name || "Someone",
      avatar_url: p?.avatar_url ?? null,
    };
  });

  return (
    <LeaveCalendarClient
      leaves={leaves}
      orgId={profile.org_id}
      currentUserId={user.id}
    />
  );
}
