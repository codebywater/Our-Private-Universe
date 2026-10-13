/**
 * Расчёт времени «с момента знакомства».
 *
 * Принципы корректности:
 *  - никакого жёстко заданного числа дней: всё считается от даты начала;
 *  - «сейчас» переводится в настенное время (wall-clock) заданного IANA-пояса
 *    через Intl, а дальше используется чистая календарная арифметика.
 *    Поэтому результат не зависит ни от часового пояса браузера, ни от
 *    переходов на летнее/зимнее время, ни от исторических смен смещения;
 *  - месяцы считаются «якорем»: дата начала + N месяцев, с прижатием дня к
 *    последнему дню месяца (30 апреля + 10 месяцев → 28/29 февраля).
 *
 * Модуль не имеет зависимостей, чтобы его можно было тестировать напрямую.
 */

export type CalendarDate = { year: number; month: number; day: number };

export type WallClock = CalendarDate & {
  hour: number;
  minute: number;
  second: number;
};

export type TimeTogether = {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Полных суток с даты начала (в выбранном часовом поясе). */
  totalDays: number;
  /** Идёт ли «сегодня» дата начала в будущем (на случай неверной настройки). */
  isFuture: boolean;
};

const MS_PER_DAY = 86_400_000;

function daysInMonth(year: number, month: number): number {
  // month: 1..12; день 0 следующего месяца = последний день текущего
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Номер дня от эпохи для календарной даты (UTC-арифметика, без DST). */
function dayNumber(d: CalendarDate): number {
  return Math.floor(Date.UTC(d.year, d.month - 1, d.day) / MS_PER_DAY);
}

/** Дата начала + n месяцев; день прижимается к концу месяца. */
function addMonths(start: CalendarDate, n: number): CalendarDate {
  const total = start.year * 12 + (start.month - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return { year, month, day: Math.min(start.day, daysInMonth(year, month)) };
}

function compareDates(a: CalendarDate, b: CalendarDate): number {
  return (
    a.year - b.year || a.month - b.month || a.day - b.day
  );
}

/** Настенное время момента `now` в IANA-часовом поясе `timeZone`. */
export function wallClockIn(now: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number.parseInt(part.value, 10) : 0;
  };

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Чистая функция: разница между датой начала (00:00) и настенным временем. */
export function diffFromWallClock(
  start: CalendarDate,
  now: WallClock,
): TimeTogether {
  const today: CalendarDate = { year: now.year, month: now.month, day: now.day };

  if (compareDates(today, start) < 0) {
    return {
      years: 0,
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalDays: 0,
      isFuture: true,
    };
  }

  // Полные месяцы: берём верхнюю оценку и уменьшаем, пока якорь не станет <= сегодня.
  let totalMonths =
    (today.year - start.year) * 12 + (today.month - start.month);
  while (totalMonths > 0 && compareDates(addMonths(start, totalMonths), today) > 0) {
    totalMonths -= 1;
  }

  const anchor = addMonths(start, totalMonths);

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: dayNumber(today) - dayNumber(anchor),
    hours: now.hour,
    minutes: now.minute,
    seconds: now.second,
    totalDays: dayNumber(today) - dayNumber(start),
    isFuture: false,
  };
}

/** Время вместе на момент `now` в часовом поясе `timeZone`. */
export function timeTogether(
  start: CalendarDate,
  timeZone: string,
  now: Date = new Date(),
): TimeTogether {
  return diffFromWallClock(start, wallClockIn(now, timeZone));
}

/** Склонение: plural(1,['год','года','лет']) → «год». */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
