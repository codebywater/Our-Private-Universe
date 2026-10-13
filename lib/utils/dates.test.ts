import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCountdown,
  formatDateRu,
  isoToZonedInput,
  todayInTimezone,
  zonedInputToIso,
} from "./dates.ts";

test("дата без смещения пояса: 30 апреля 2013", () => {
  assert.equal(formatDateRu("2013-04-30"), "30 апреля 2013 г.");
});

test("Москва (UTC+3): локальное время → UTC", () => {
  assert.equal(
    zonedInputToIso("2026-10-12T10:00", "Europe/Moscow"),
    "2026-10-12T07:00:00.000Z",
  );
});

test("Нью-Йорк: зимнее и летнее время", () => {
  assert.equal(
    zonedInputToIso("2026-01-15T12:00", "America/New_York"),
    "2026-01-15T17:00:00.000Z",
  ); // UTC-5
  assert.equal(
    zonedInputToIso("2026-07-15T12:00", "America/New_York"),
    "2026-07-15T16:00:00.000Z",
  ); // UTC-4
});

test("обратное преобразование совпадает с прямым", () => {
  for (const tz of ["Europe/Moscow", "America/New_York", "Asia/Tokyo", "UTC"]) {
    const iso = zonedInputToIso("2027-03-09T08:30", tz);
    assert.ok(iso);
    assert.equal(isoToZonedInput(iso, tz), "2027-03-09T08:30");
  }
});

test("некорректный ввод → null", () => {
  assert.equal(zonedInputToIso("", "UTC"), null);
  assert.equal(zonedInputToIso("2026-10-12", "UTC"), null);
});

test("сегодняшняя дата в поясе", () => {
  const instant = new Date("2026-10-11T21:30:00Z");
  assert.equal(todayInTimezone("Europe/Moscow", instant), "2026-10-12");
  assert.equal(todayInTimezone("America/New_York", instant), "2026-10-11");
});

test("обратный отсчёт", () => {
  const now = Date.parse("2026-10-12T00:00:00Z");
  assert.equal(formatCountdown("2026-10-15T04:00:00Z", now), "3 д. 4 ч.");
  assert.equal(formatCountdown("2026-10-12T05:30:00Z", now), "5 ч. 30 мин.");
  assert.equal(formatCountdown("2026-10-12T00:10:00Z", now), "10 мин.");
  assert.equal(formatCountdown("2026-10-11T00:00:00Z", now), "уже можно открыть");
});
