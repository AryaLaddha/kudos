import type { createClient } from "@/lib/supabase/server";

/**
 * TEMPORARY, kudosdev only: sample "Most recognised" and "Trending" data so
 * the Feed side panel (FeedRail) can be previewed in DEV while nobody has
 * been recognised this month.
 *
 * - Never used on Vercel production (VERCEL_ENV === "production").
 * - Only used when the month has no real data; real data always wins.
 * - Remove this file and the lines marked "sample" in FeedRail.tsx before
 *   kudosdev is merged into main.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Person = { id: string; full_name: string | null; avatar_url: string | null };

const SAMPLE_PEOPLE: [Person, number][] = [
  [{ id: "sample-1", full_name: "Alex Morgan", avatar_url: null }, 120],
  [{ id: "sample-2", full_name: "Priya Shah", avatar_url: null }, 95],
  [{ id: "sample-3", full_name: "Sam Taylor", avatar_url: null }, 60],
  [{ id: "sample-4", full_name: "Riley Kim", avatar_url: null }, 45],
];

const SAMPLE_TAGS: [string, number][] = [
  ["teamwork", 9],
  ["mentorship", 7],
  ["above-and-beyond", 5],
  ["innovation", 4],
  ["problem-solving", 3],
  ["leadership", 3],
  ["customer-first", 2],
];

export const isSampleId = (id: string) => id.startsWith("sample-");

export async function getSampleRail(
  supabase: Supabase,
  currentUserId: string,
  hasRealData: boolean
): Promise<{ top: [string, number][]; people: Person[]; tags: [string, number][] } | null> {
  if (hasRealData || process.env.VERCEL_ENV === "production") return null;

  // Put the viewer at #3 so the "(you)" row style can be previewed too.
  const { data: me } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", currentUserId)
    .single();

  const rows = [...SAMPLE_PEOPLE];
  if (me) rows.splice(2, 0, [me as Person, 80]);
  const top5 = rows.slice(0, 5);

  return {
    top: top5.map(([p, pts]) => [p.id, pts]),
    people: top5.map(([p]) => p),
    tags: SAMPLE_TAGS,
  };
}
