import { Hero } from "@/components/hero/hero";
import { HomeHighlights } from "@/components/hero/home-highlights";
import { StorySection } from "@/components/hero/story-section";
import { serverNowSeconds } from "@/lib/utils/server-now";

export const dynamic = "force-dynamic";

export default function HomePage() {
  // Время сервера для первого рендера счётчика: в HTML сразу реальные числа
  const initialNow = serverNowSeconds();
  return (
    <main id="main">
      <Hero initialNow={initialNow} />
      <StorySection initialNow={initialNow} />
      <HomeHighlights />
    </main>
  );
}
