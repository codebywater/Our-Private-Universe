import type { Metadata } from "next";
import { MemoriesView } from "@/components/memories/memories-view";
import { requireMember } from "@/lib/auth/session";
import { fetchMemoriesPage, fetchMemoryCategories, fetchMemoryYears } from "@/lib/data/memories";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Воспоминания" };

export default async function MemoriesPage() {
  await requireMember("/memories");
  const [initial, categories, years] = await Promise.all([
    fetchMemoriesPage({}),
    fetchMemoryCategories(),
    fetchMemoryYears(),
  ]);

  return (
    <main id="main" className="mx-auto w-full max-w-7xl px-5 pb-32 pt-32 sm:px-8 sm:pt-40">
      <MemoriesView initial={initial} categories={categories} years={years} />
    </main>
  );
}
