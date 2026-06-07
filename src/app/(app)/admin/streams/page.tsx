import { requireAdmin } from "@/lib/auth";
import { getStreams } from "./actions";
import StreamsManagementClient from "@/components/app/StreamsManagementClient";

export const metadata = {
  title: "Streams | Kudos",
  description: "Manage the organisation's work streams",
};

export default async function AdminStreamsPage() {
  await requireAdmin();
  const streams = await getStreams();
  return <StreamsManagementClient initialStreams={streams} />;
}
