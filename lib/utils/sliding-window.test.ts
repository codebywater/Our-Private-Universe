import { test } from "node:test";
import assert from "node:assert/strict";
import { createSlidingWindowLimiter } from "./sliding-window.ts";

test("пропускает до лимита, затем блокирует", () => {
  const l = createSlidingWindowLimiter();
  const t0 = 1_000_000;
  assert.equal(l.check("a", 3, 60_000, t0).allowed, true);
  assert.equal(l.check("a", 3, 60_000, t0 + 1).allowed, true);
  assert.equal(l.check("a", 3, 60_000, t0 + 2).allowed, true);
  const blocked = l.check("a", 3, 60_000, t0 + 3);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 59 && blocked.retryAfterSec <= 60);
});

test("окно скользит: после истечения снова можно", () => {
  const l = createSlidingWindowLimiter();
  const t0 = 5_000_000;
  l.check("a", 1, 10_000, t0);
  assert.equal(l.check("a", 1, 10_000, t0 + 5_000).allowed, false);
  assert.equal(l.check("a", 1, 10_000, t0 + 10_001).allowed, true);
});

test("ключи независимы", () => {
  const l = createSlidingWindowLimiter();
  l.check("a", 1, 10_000, 1);
  assert.equal(l.check("b", 1, 10_000, 2).allowed, true);
});

test("память ограничена", () => {
  const l = createSlidingWindowLimiter(10);
  for (let i = 0; i < 100; i++) l.check(`k${i}`, 5, 1_000, i * 10_000);
  assert.ok(l.size() <= 12);
});
