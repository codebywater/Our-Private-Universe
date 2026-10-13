import type { Metadata } from "next";
import { TimelineView } from "@/components/timeline/timeline-view";
import { requireMember } from "@/lib/auth/session";
import { fetchTimeline } from "@/lib/data/timeline";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage() {
  await requireMember("/timeline");
  const events = await fetchTimeline();
  return (
    <main id="main" className="mx-auto w-full max-w-7xl px-5 pb-32 pt-32 sm:px-8 sm:pt-40">
      <TimelineView events={events} />
    </main>
  );
}
