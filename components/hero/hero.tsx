"use client";

import { motion, type Variants } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Monogram } from "@/components/hero/logo";
import { Starfield } from "@/components/hero/starfield";
import { TimeCounter } from "@/components/hero/time-counter";
import { buttonClasses } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.16, delayChildren: 0.15 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 34, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
  },
};

function formatStartDate(): string {
  const { year, month, day } = siteConfig.meetingDate;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

export function Hero({ initialNow }: { initialNow?: number }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-5 pb-24 pt-28 sm:px-8"
    >
      {/* Кинематографичный фон: фото (заглушка), звёзды, свечение, виньетка */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {siteConfig.images.hero ? (
          <div className="absolute inset-0 motion-safe:animate-[drift_40s_ease-in-out_infinite]">
            <Image
              src={siteConfig.images.hero}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-70"
            />
            {/* Затемнение для читаемости текста поверх фотографии */}
            <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/45 to-ink" />
          </div>
        ) : null}
        <Starfield />
        <div className="absolute left-1/2 top-[38%] size-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[150px]" />
        <div className="vignette absolute inset-0" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex w-full max-w-5xl flex-col items-center text-center"
      >
        <motion.div variants={rise}>
          <Monogram size="lg" />
        </motion.div>

        <motion.p
          variants={rise}
          className="mt-10 text-xs font-medium uppercase tracking-[0.5em] text-accent sm:text-sm"
        >
          Private archive
        </motion.p>

        <motion.h1
          id="hero-title"
          variants={rise}
          className="mt-5 font-display text-[clamp(3.6rem,14vw,10.5rem)] font-light leading-[0.9] tracking-tight text-text text-glow"
        >
          Гриша <span className="font-normal italic text-accent">×</span> Катя
        </motion.h1>

        <motion.p
          variants={rise}
          className="mt-8 max-w-2xl font-display text-2xl font-light italic leading-snug text-text/85 sm:text-3xl"
        >
          {siteConfig.tagline}.
        </motion.p>

        <motion.p variants={rise} className="mt-6 font-mono text-sm tracking-[0.3em] text-muted">
          <span className="sr-only">Дата знакомства: </span>
          <time dateTime={`${siteConfig.meetingDate.year}-${String(siteConfig.meetingDate.month).padStart(2, "0")}-${String(siteConfig.meetingDate.day).padStart(2, "0")}`}>{formatStartDate()}</time>
        </motion.p>

        <motion.div variants={rise} className="mt-14 w-full max-w-3xl">
          <TimeCounter initialNow={initialNow} />
        </motion.div>

        <motion.div variants={rise} className="mt-14">
          <Link
            href="#story"
            className={buttonClasses({ variant: "primary", size: "lg" })}
          >
            Открыть нашу историю
          </Link>
        </motion.div>
      </motion.div>

      <a
        href="#story"
        aria-label="Прокрутить вниз"
        className="absolute bottom-6 left-1/2 grid -translate-x-1/2 place-items-center text-muted transition hover:text-text"
      >
        <ChevronDown className="size-6 motion-safe:animate-bounce" aria-hidden="true" />
      </a>
    </section>
  );
}
