"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Profile } from "@/types";

export async function getOrgUsers(): Promise<(Profile & { email: string })[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, department, job_title, monthly_allowance, points_balance, is_admin, is_active, created_at")
    .eq("org_id", profile.org_id)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching org users:", error);
    return [];
  }

  // Fetch emails from auth.users via admin RPC — fall back to empty string if unavailable
  const { data: authUsers } = await supabase.rpc("get_org_user_emails", {
    p_org_id: profile.org_id,
  });

  const emailMap: Record<string, string> = {};
  if (authUsers) {
    for (const u of authUsers as { id: string; email: string }[]) {
      emailMap[u.id] = u.email;
    }
  }

  return (data as Profile[]).map(p => ({
    ...p,
    email: emailMap[p.id] ?? "",
  }));
}

export async function setUserActive(
  userId: string,
  isActive: boolean
): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorized" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_active", {
    p_user_id: userId,
    p_is_active: isActive,
  });

  if (error) {
    console.error("Error setting user active:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return {};
}

export async function setUserAdmin(
  userId: string,
  adminFlag: boolean
): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorized" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_admin", {
    p_user_id: userId,
    p_is_admin: adminFlag,
  });

  if (error) {
    console.error("Error setting user admin:", error);
    // Surface the friendly guard messages from the RPC
    if (error.message.includes("cannot_demote_self")) {
      return { error: "You cannot remove your own admin access." };
    }
    if (error.message.includes("org_mismatch")) {
      return { error: "That user is not in your organisation." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return {};
}

export async function inviteUser(formData: {
  email: string;
  full_name?: string;
  department?: string;
  job_title?: string;
}): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorized" };

  const { email, full_name, department, job_title } = formData;

  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return { error: "A valid email address is required." };
  }

  // Resolve the org_id of the calling admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!adminProfile?.org_id) return { error: "No organisation found for your account." };

  const adminClient = createAdminClient();

  // 1. Create the auth user immediately (email_confirm: true skips the
  //    confirmation step so the account is live right away).
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: full_name ?? "",
      org_id: adminProfile.org_id,
    },
  });

  if (createError) {
    console.error("Create user error:", createError);
    return { error: createError.message };
  }

  // 2. Insert or update the profile row 
  // (In case the handle_new_user trigger silently failed to insert the profile, we UPSERT it here)
  if (created?.user?.id) {
    await adminClient
      .from("profiles")
      .upsert({
        id: created.user.id,
        org_id: adminProfile.org_id,
        full_name: full_name ?? "",
        ...(department ? { department } : {}),
        ...(job_title ? { job_title } : {}),
      });
  }

  // 3. Generate a setup link and email it directly using Resend's REST API.
  // This bypasses Supabase's internal SMTP forwarder which is failing for you.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("supabase.co", "vercel.app") ??
    "http://localhost:3000";

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: email,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/auth/reset-password`,
    }
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.warn("Could not generate setup link:", linkError?.message);
  } else {
    // Send email directly using Resend
    const resendApiKey = process.env.RESEND_API_KEY; // You need to add this to Vercel env
    if (resendApiKey) {
      try {
        const setupLink = linkData.properties.action_link;
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            // Make sure this matches a verified domain in your Resend account (e.g. noreply@scape.com.au)
            from: 'Kudos <noreply@resend.dev>', // Change the domain here if Resend complains
            to: [email],
            subject: 'You have been invited to Kudos',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #4f46e5;">Welcome to Kudos!</h2>
                <p>Hi ${full_name || 'there'},</p>
                <p>You have been invited to join the Kudos platform.</p>
                <p>Click the button below to set up your password and access your account:</p>
                <div style="margin: 30px 0;">
                  <a href="${setupLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Your Password</a>
                </div>
                <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${setupLink}" style="color: #4f46e5; word-break: break-all;">${setupLink}</a></p>
              </div>
            `
          })
        });
        console.log("Resend API email sent successfully");
      } catch (e) {
        console.error("Failed to send email via Resend API", e);
      }
    } else {
      console.warn("RESEND_API_KEY not found in environment variables. Email could not be sent.");
    }
  }

  revalidatePath("/admin/users");
  return {};
}
