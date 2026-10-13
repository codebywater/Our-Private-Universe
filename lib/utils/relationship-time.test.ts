import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diffFromWallClock,
  pluralRu,
  timeTogether,
  wallClockIn,
  type CalendarDate,
} from "./relationship-time.ts";

const START: CalendarDate = { year: 2013, month: 4, day: 30 };

const at = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
) => ({ year, month, day, hour, minute, second });

test("в день знакомства всё по нулям", () => {
  const r = diffFromWallClock(START, at(2013, 4, 30, 0, 0, 0));
  assert.deepEqual(
    [r.years, r.months, r.days, r.totalDays, r.isFuture],
    [0, 0, 0, 0, false],
  );
});

test("ровно год", () => {
  const r = diffFromWallClock(START, at(2014, 4, 30));
  assert.deepEqual([r.years, r.months, r.days], [1, 0, 0]);
});

test("день до годовщины", () => {
  const r = diffFromWallClock(START, at(2014, 4, 29));
  assert.deepEqual([r.years, r.months, r.days], [0, 11, 30]); // якорь 30.03.2014 → 29.04.2014 = 30 дней
});

test("прижатие дня к концу короткого месяца (30 апреля → февраль)", () => {
  // 28.02.2014: якорь 30.04.2013 + 10 мес. прижимается к 28.02.2014
  const r = diffFromWallClock(START, at(2014, 2, 28));
  assert.deepEqual([r.years, r.months, r.days], [0, 10, 0]);
});

test("високосный год: 29.02.2016", () => {
  const r = diffFromWallClock(START, at(2016, 2, 29));
  // 30.04.2013 + 2г 10м = 29.02.2016 (прижато, т.к. 30.02 нет)
  assert.deepEqual([r.years, r.months, r.days], [2, 10, 0]);
});

test("totalDays совпадает с независимым подсчётом через UTC", () => {
  const now = at(2026, 10, 12, 10, 18, 5);
  const r = diffFromWallClock(START, now);
  const expected = Math.round(
    (Date.UTC(2026, 9, 12) - Date.UTC(2013, 3, 30)) / 86_400_000,
  );
  assert.equal(r.totalDays, expected);
});

test("часы/минуты/секунды берутся из настенного времени", () => {
  const r = diffFromWallClock(START, at(2020, 6, 1, 23, 59, 58));
  assert.deepEqual([r.hours, r.minutes, r.seconds], [23, 59, 58]);
});

test("дата начала в будущем не даёт отрицательных значений", () => {
  const r = diffFromWallClock({ year: 2099, month: 1, day: 1 }, at(2026, 1, 1));
  assert.equal(r.isFuture, true);
  assert.equal(r.totalDays, 0);
});

test("часовой пояс определяет границу суток", () => {
  // 2026-10-11T21:30:00Z — в Москве (UTC+3) это уже 12 октября 00:30,
  // а в Нью-Йорке (UTC-4) ещё 11 октября 17:30.
  const instant = new Date("2026-10-11T21:30:00Z");
  const moscow = wallClockIn(instant, "Europe/Moscow");
  const ny = wallClockIn(instant, "America/New_York");
  assert.deepEqual([moscow.day, moscow.hour], [12, 0]);
  assert.deepEqual([ny.day, ny.hour], [11, 17]);

  const a = timeTogether(START, "Europe/Moscow", instant);
  const b = timeTogether(START, "America/New_York", instant);
  assert.equal(a.totalDays - b.totalDays, 1);
});

test("переход на летнее время не ломает счёт (America/New_York, 2026-03-08)", () => {
  const before = wallClockIn(new Date("2026-03-08T06:59:59Z"), "America/New_York");
  const after = wallClockIn(new Date("2026-03-08T07:00:00Z"), "America/New_York");
  assert.deepEqual([before.hour, after.hour], [1, 3]);
  const r1 = diffFromWallClock(START, before);
  const r2 = diffFromWallClock(START, after);
  assert.equal(r1.totalDays, r2.totalDays);
});

test("склонения", () => {
  const years = ["год", "года", "лет"] as const;
  assert.equal(pluralRu(1, years), "год");
  assert.equal(pluralRu(2, years), "года");
  assert.equal(pluralRu(5, years), "лет");
  assert.equal(pluralRu(11, years), "лет");
  assert.equal(pluralRu(13, years), "лет");
  assert.equal(pluralRu(21, years), "год");
  assert.equal(pluralRu(112, years), "лет");
});
