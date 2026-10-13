import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffImage } from "./image-sniff.ts";

const pad = (arr: number[], len = 64) => {
  const out = new Uint8Array(len);
  out.set(arr);
  return out;
};
const text = (s: string) => [...s].map((c) => c.charCodeAt(0));

test("JPEG", () => {
  assert.equal(sniffImage(pad([0xff, 0xd8, 0xff, 0xe0])), "jpeg");
});

test("PNG", () => {
  assert.equal(
    sniffImage(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "png",
  );
});

test("WebP", () => {
  assert.equal(sniffImage(pad([...text("RIFF"), 0, 0, 0, 0, ...text("WEBP")])), "webp");
});

test("AVIF: основной бренд", () => {
  assert.equal(
    sniffImage(pad([0, 0, 0, 24, ...text("ftyp"), ...text("avif"), 0, 0, 0, 0])),
    "avif",
  );
});

test("AVIF: совместимый бренд", () => {
  assert.equal(
    sniffImage(
      pad([0, 0, 0, 28, ...text("ftyp"), ...text("mif1"), 0, 0, 0, 0, ...text("avif")]),
    ),
    "avif",
  );
});

test("HEIC, GIF, SVG, PDF и исполняемые файлы отклоняются", () => {
  assert.equal(
    sniffImage(pad([0, 0, 0, 24, ...text("ftyp"), ...text("heic"), 0, 0, 0, 0])),
    null,
  );
  assert.equal(sniffImage(pad(text("GIF89a......"))), null);
  assert.equal(sniffImage(pad(text("<svg xmlns=...."))), null);
  assert.equal(sniffImage(pad(text("%PDF-1.7......"))), null);
  assert.equal(sniffImage(pad([0x4d, 0x5a, 0x90, 0x00])), null); // MZ (exe)
  assert.equal(sniffImage(pad(text("<?php echo 1;"))), null);
});

test("слишком короткий буфер", () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff])), null);
});
