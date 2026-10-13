import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { getAccess } from "@/lib/auth/session";
import { fetchMemoriesPage } from "@/lib/data/memories";
import { fetchTimeline } from "@/lib/data/timeline";
import { formatDateRu } from "@/lib/utils/dates";

/**
 * Избранное на главной: последние воспоминания и ближайшие события хронологии.
 * Личные данные читаются только после серверной проверки доступа; для гостя
 * блок не рендерится вовсе.
 */
export async function HomeHighlights() {
  const access = await getAccess();
  if (access.status !== "member") return null;

  const [page, events] = await Promise.all([fetchMemoriesPage({}), fetchTimeline()]);
  const memories = page.items.filter((m) => m.thumbUrl).slice(0, 6);
  const recentEvents = events.slice(-3).reverse();

  if (memories.length === 0 && recentEvents.length === 0) return null;

  return (
    <section aria-labelledby="highlights-title" className="px-5 pb-32 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.35em] text-accent">Избранное</p>
          <h2 id="highlights-title" className="font-display text-4xl font-light text-text sm:text-6xl">
            Недавнее в нашем архиве
          </h2>
        </Reveal>

        {memories.length > 0 ? (
          <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {memories.map((m) => (
              <li key={m.id}>
                <Link
                  href="/memories"
                  className="group relative block aspect-[4/5] overflow-hidden rounded-2xl border border-line"
                  aria-label={m.title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- подписанный URL */}
                  <img
                    src={m.thumbUrl ?? ""}
                    alt={m.caption ?? m.title}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition duration-700 group-hover:scale-105"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {recentEvents.length > 0 ? (
          <ol className="mt-16 border-t border-line">
            {recentEvents.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 border-b border-line py-5 sm:flex-row sm:items-baseline sm:gap-8">
                <time dateTime={e.eventDate} className="w-56 shrink-0 font-mono text-xs uppercase tracking-[0.2em] text-accent">
                  {formatDateRu(e.eventDate)}
                </time>
                <Link href="/timeline" className="font-display text-2xl text-text transition hover:text-accent">
                  {e.title}
                </Link>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
