"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Leave, LeaveType } from "@/types";

const VALID_TYPES: LeaveType[] = ["annual", "sick", "public_holiday", "emergency", "custom"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_LABEL = 40;
const MAX_RANGE_DAYS = 366;

function dayDiff(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const a = Date.UTC(sy, sm - 1, sd);
  const b = Date.UTC(ey, em - 1, ed);
  return Math.round((b - a) / 86_400_000);
}

export async function addLeave(
  startDate: string,
  endDate: string,
  leaveType: LeaveType,
  customLabel: string,
  orgId: string,
): Promise<{ error?: string; leave?: Leave }> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  // Validate dates
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return { error: "Please choose valid dates." };
  }
  const diff = dayDiff(startDate, endDate);
  if (diff < 0) return { error: "The end date can't be before the start date." };
  if (diff > MAX_RANGE_DAYS) return { error: "That leave range is too long." };

  // Validate type
  if (!VALID_TYPES.includes(leaveType)) return { error: "Please choose a leave type." };

  const trimmedLabel = customLabel.trim();
  if (leaveType === "custom") {
    if (!trimmedLabel) return { error: "Please name your custom leave." };
    if (trimmedLabel.length > MAX_CUSTOM_LABEL) {
      return { error: `Custom name must be ${MAX_CUSTOM_LABEL} characters or fewer.` };
    }
  }

  // Verify org matches caller's own org (defence in depth alongside RLS)
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id || profile.org_id !== orgId) {
    return { error: "Organisation mismatch." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("leaves")
    .insert({
      user_id: user.id,
      org_id: orgId,
      leave_type: leaveType,
      custom_label: leaveType === "custom" ? trimmedLabel : null,
      start_date: startDate,
      end_date: endDate,
    })
    .select("id, org_id, user_id, leave_type, custom_label, start_date, end_date, created_at")
    .single();

  if (insertError || !inserted) {
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/leave");
  return {
    leave: {
      ...(inserted as Leave),
      user_name: profile.full_name || user.email?.split("@")[0] || "You",
      avatar_url: profile.avatar_url,
    },
  };
}

export async function deleteLeave(id: string): Promise<{ error?: string }> {
  if (!id) return { error: "Invalid leave." };

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  // RLS guarantees a user can only delete their own leave (admins, any in their org).
  const { error: deleteError } = await supabase
    .from("leaves")
    .delete()
    .eq("id", id);

  if (deleteError) return { error: "Something went wrong. Please try again." };

  revalidatePath("/leave");
  return {};
}
