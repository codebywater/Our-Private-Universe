import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { TotalDays } from "@/components/hero/time-counter";
import { Reveal } from "@/components/ui/reveal";
import { siteConfig } from "@/lib/site-config";
import { formatDateRu } from "@/lib/utils/dates";

const { year, month, day } = siteConfig.meetingDate;
const startLabel = formatDateRu(
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
).replace(" г.", "");

const chapters = [
  {
    href: "/memories",
    title: "Воспоминания",
    text: "Фотографии с названиями, датами и подписями — в приватном хранилище.",
  },
  {
    href: "/timeline",
    title: "Timeline",
    text: "Важные события в порядке времени — от первой даты до сегодняшнего дня.",
  },
  {
    href: "/letters",
    title: "Письма",
    text: "Письма друг другу, которые можно запечатать до нужного дня.",
  },
  {
    href: "/archive",
    title: "Архив",
    text: "Обзор всего, что вы собрали вместе.",
  },
] as const;

/** Раздел «Наша история»: общая информация без личных данных (публичная часть). */
export function StorySection({ initialNow }: { initialNow?: number }) {
  return (
    <section
      id="story"
      aria-labelledby="story-title"
      className="relative scroll-mt-20 px-5 py-28 sm:px-8 sm:py-40"
    >
      <div className={`mx-auto grid max-w-7xl items-center gap-16 lg:gap-24 ${siteConfig.images.story ? "lg:grid-cols-[1.1fr_0.9fr]" : ""}`}>
        <div>
          <Reveal>
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.35em] text-accent">
              Наша история
            </p>
            <h2
              id="story-title"
              className="font-display text-5xl font-light leading-[1.02] tracking-tight text-text sm:text-7xl"
            >
              Всё началось <br className="hidden sm:block" />
              <span className="italic text-accent">{startLabel}</span>
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
              Это приватный цифровой архив двух людей. Здесь собираются
              фотографии, даты и письма — всё, что хочется сохранить и
              возвращаться к этому снова.
            </p>
            <TotalDays className="mt-10" initialNow={initialNow} />
          </Reveal>

          <ol className="mt-16 border-t border-line">
            {chapters.map((chapter, i) => (
              <Reveal key={chapter.href} as="li" delay={0.05 * i}>
                <Link
                  href={chapter.href}
                  className="group flex items-baseline gap-5 border-b border-line py-6 transition-colors hover:border-accent/50 sm:gap-8"
                >
                  <span className="w-8 shrink-0 text-xs tracking-[0.3em] text-muted">
                    0{i + 1}
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-3xl font-light text-text transition-colors group-hover:text-accent sm:text-4xl">
                      {chapter.title}
                    </span>
                    <span className="mt-1 block max-w-md text-sm leading-relaxed text-muted">
                      {chapter.text}
                    </span>
                  </span>
                  <ArrowUpRight
                    className="size-6 shrink-0 text-muted transition duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-accent"
                    aria-hidden="true"
                  />
                </Link>
              </Reveal>
            ))}
          </ol>
        </div>

        {siteConfig.images.story ? (
        <Reveal delay={0.15} className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-line-strong glow-accent">
            <Image
              src={siteConfig.images.story}
              alt="Фотография пары"
              fill
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="object-cover"
            />
            <div aria-hidden="true" className="vignette absolute inset-0 opacity-70" />
          </div>
        </Reveal>
        ) : null}
      </div>
    </section>
  );
}
