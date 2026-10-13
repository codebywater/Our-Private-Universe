import "server-only";
import { getMembers, requireMember } from "@/lib/auth/session";
import { SIGNED_URL_TTL, signUrls } from "@/lib/data/media";
import { createClient } from "@/lib/supabase/server";

export type TimelineItem = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string | null;
  hasCover: boolean;
  coverUrl: string | null;
  authorName: string | null;
};

const MAX_EVENTS = 500;

/** Все события по возрастанию даты (история читается как фильм — от начала). */
export async function fetchTimeline(): Promise<TimelineItem[]> {
  await requireMember("/timeline");
  const supabase = await createClient();
  const members = await getMembers();
  const names = new Map(members.map((m) => [m.id, m.displayName]));

  const { data, error } = await supabase
    .from("timeline_events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("id", { ascending: true })
    .limit(MAX_EVENTS);

  if (error) throw new Error("timeline_query_failed", { cause: { code: error.code } });

  const rows = data ?? [];
  const urls = await signUrls(
    supabase,
    rows.map((r) => r.thumb_path ?? r.image_path),
    SIGNED_URL_TTL.thumb,
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    eventDate: r.event_date,
    location: r.location,
    hasCover: Boolean(r.image_path),
    coverUrl: urls.get(r.thumb_path ?? r.image_path ?? "") ?? null,
    authorName: r.created_by ? (names.get(r.created_by) ?? null) : null,
  }));
}
