import { wallClockIn } from "./relationship-time.ts";

/**
 * Форматирование дат. Везде явно указывается часовой пояс, поэтому результат
 * на сервере (SSR) и в браузере совпадает — без ошибок гидрации.
 */

const dateLong = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const monthYear = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** «30 апреля 2013» из календарной даты YYYY-MM-DD (без смещения пояса). */
export function formatDateRu(dateOnly: string): string {
  return dateLong.format(new Date(`${dateOnly}T00:00:00Z`));
}

/** «апрель 2013» */
export function formatMonthYearRu(dateOnly: string): string {
  return monthYear.format(new Date(`${dateOnly}T00:00:00Z`));
}

/** «12 октября 2026 г., 10:18» для момента времени в заданном поясе. */
export function formatDateTimeRu(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

/** Только дата момента времени в заданном поясе. */
export function formatDayRu(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(iso));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Сегодняшняя календарная дата YYYY-MM-DD в заданном поясе. */
export function todayInTimezone(timeZone: string, now: Date = new Date()): string {
  const w = wallClockIn(now, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/**
 * Значение <input type="datetime-local"> («YYYY-MM-DDTHH:mm»), понимаемое как
 * настенное время в поясе `timeZone`, → ISO-момент UTC.
 */
export function zonedInputToIso(value: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const target = Date.UTC(y, mo - 1, d, h, mi);

  let utc = target;
  // Две итерации достаточно, чтобы учесть смещение пояса (в т.ч. DST)
  for (let i = 0; i < 2; i++) {
    const w = wallClockIn(new Date(utc), timeZone);
    const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
    utc -= wallAsUtc - target;
  }
  const result = new Date(utc);
  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}

/** ISO-момент → значение для <input type="datetime-local"> в поясе `timeZone`. */
export function isoToZonedInput(iso: string, timeZone: string): string {
  const w = wallClockIn(new Date(iso), timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** Остаток времени до момента `targetIso` в удобном виде («3 д. 4 ч.»). */
export function formatCountdown(targetIso: string, nowMs: number): string {
  const diff = new Date(targetIso).getTime() - nowMs;
  if (diff <= 0) return "уже можно открыть";
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} д. ${hours} ч.`;
  if (hours > 0) return `${hours} ч. ${minutes} мин.`;
  return `${Math.max(1, minutes)} мин.`;
}
