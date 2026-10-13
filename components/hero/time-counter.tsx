"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { publicEnv } from "@/lib/env";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils/cn";
import {
  pluralRu,
  timeTogether,
  type TimeTogether,
} from "@/lib/utils/relationship-time";

/* ----------------------------------------------------------------------------
 * Общие «часы»: один setInterval на все счётчики на странице.
 * Серверный снимок = время сервера (initialNow, секунды), переданное со страницы:
 * HTML сразу содержит реальные числа. При гидрации React берёт тот же снимок
 * (без рассинхронизации), затем переключается на клиентские часы. Если
 * initialNow не передан — показываются заглушки.
 * ------------------------------------------------------------------------- */
let nowSeconds = 0;
const listeners = new Set<() => void>();
let timer: number | undefined;

function tick() {
  nowSeconds = Math.floor(Date.now() / 1000);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    tick();
    timer = window.setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => {
  // Кэшируем: до первого тика берём время один раз, чтобы после гидрации
  // не мелькали заглушки.
  if (nowSeconds === 0) nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds;
};

export function useTimeTogether(initialNow = 0): TimeTogether | null {
  const getServerSnapshot = useCallback(() => initialNow, [initialNow]);
  const seconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(
    () =>
      seconds === 0
        ? null
        : timeTogether(siteConfig.startDate, publicEnv.timezone, new Date(seconds * 1000)),
    [seconds],
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function describe(t: TimeTogether): string {
  const parts: string[] = [];
  if (t.years) parts.push(`${t.years} ${pluralRu(t.years, ["год", "года", "лет"])}`);
  if (t.months) parts.push(`${t.months} ${pluralRu(t.months, ["месяц", "месяца", "месяцев"])}`);
  parts.push(`${t.days} ${pluralRu(t.days, ["день", "дня", "дней"])}`);
  return parts.join(", ");
}

/** Счётчик «мы вместе»: годы, месяцы, дни, часы, минуты, секунды. */
export function TimeCounter({ className, initialNow }: { className?: string; initialNow?: number }) {
  const t = useTimeTogether(initialNow);

  const units = [
    { value: t?.years, label: t ? pluralRu(t.years, ["год", "года", "лет"]) : "лет", pad: false },
    { value: t?.months, label: t ? pluralRu(t.months, ["месяц", "месяца", "месяцев"]) : "месяцев", pad: false },
    { value: t?.days, label: t ? pluralRu(t.days, ["день", "дня", "дней"]) : "дней", pad: false },
    { value: t?.hours, label: t ? pluralRu(t.hours, ["час", "часа", "часов"]) : "часов", pad: true },
    { value: t?.minutes, label: t ? pluralRu(t.minutes, ["минута", "минуты", "минут"]) : "минут", pad: true },
    { value: t?.seconds, label: t ? pluralRu(t.seconds, ["секунда", "секунды", "секунд"]) : "секунд", pad: true },
  ];

  return (
    <div className={className} role="group" aria-label="Мы вместе">
      {/* Скринридеру — спокойная фраза без ежесекундных обновлений */}
      <p className="sr-only">{t ? `Мы вместе: ${describe(t)}` : "Считаем время вместе"}</p>
      <dl
        aria-hidden="true"
        className="grid grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-6 sm:gap-x-0"
      >
        {units.map((u, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col items-center px-2 sm:px-5",
              i > 0 && "sm:border-l sm:border-line",
            )}
          >
            <dd className="font-mono text-3xl font-light tabular-nums leading-none text-text text-glow sm:text-4xl">
              {u.value === undefined ? "––" : u.pad ? pad2(u.value) : u.value}
            </dd>
            <dt className="mt-2 text-[0.65rem] uppercase tracking-[0.25em] text-muted sm:text-xs">
              {u.label}
            </dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Крупное «N дней вместе». */
export function TotalDays({ className, initialNow }: { className?: string; initialNow?: number }) {
  const t = useTimeTogether(initialNow);
  const formatted = t ? new Intl.NumberFormat("ru-RU").format(t.totalDays) : "–";
  return (
    <p className={className}>
      <span className="font-mono text-6xl font-light tabular-nums text-text text-glow sm:text-7xl">
        {formatted}
      </span>{" "}
      <span className="text-lg text-muted">
        {t ? pluralRu(t.totalDays, ["день", "дня", "дней"]) : "дней"} вместе
      </span>
    </p>
  );
}
