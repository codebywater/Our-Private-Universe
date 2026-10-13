import type { Metadata } from "next";
import { LettersView } from "@/components/letters/letters-view";
import { requireMember } from "@/lib/auth/session";
import { fetchLettersOverview } from "@/lib/data/letters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Письма" };

export default async function LettersPage() {
  await requireMember("/letters");
  const overview = await fetchLettersOverview();
  return (
    <main id="main" className="mx-auto w-full max-w-7xl px-5 pb-32 pt-32 sm:px-8 sm:pt-40">
      <LettersView overview={overview} />
    </main>
  );
}
