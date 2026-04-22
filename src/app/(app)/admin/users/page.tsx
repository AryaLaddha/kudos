import { requireUserManager } from "@/lib/auth";
import { getOrgUsers } from "./actions";
import UsersManagementClient from "@/components/app/UsersManagementClient";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "User Management | Kudos",
  description: "Manage organisation members and their access",
};

export default async function AdminUsersPage() {
  await requireUserManager();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const users = await getOrgUsers();

  return <UsersManagementClient initialUsers={users} currentUserId={user!.id} />;
}
