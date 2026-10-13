import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "./safe-redirect.ts";

test("обычные внутренние пути проходят", () => {
  assert.equal(safeNextPath("/memories"), "/memories");
  assert.equal(safeNextPath("/letters?tab=sent"), "/letters?tab=sent");
  assert.equal(safeNextPath("/timeline#2013"), "/timeline#2013");
});

test("внешние адреса и протокол-относительные ссылки отклоняются", () => {
  for (const bad of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "evil.example/path",
    "/\t/evil.example",
    "/%0d%0aSet-Cookie:x=1".replace("%0d%0a", "\r\n"),
  ]) {
    assert.equal(safeNextPath(bad, "/"), "/", `должен отклонить: ${JSON.stringify(bad)}`);
  }
});

test("пустое и неверный тип дают fallback", () => {
  assert.equal(safeNextPath(undefined, "/x"), "/x");
  assert.equal(safeNextPath(null, "/x"), "/x");
  assert.equal(safeNextPath("", "/x"), "/x");
  assert.equal(safeNextPath("a".repeat(600), "/x"), "/x");
});
