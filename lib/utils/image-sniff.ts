/**
 * Определение типа изображения по сигнатуре (magic bytes).
 * Content-Type, который присылает браузер, не считается доказательством.
 * Модуль без зависимостей: работает и в браузере, и на сервере.
 */
export type ImageKind = "jpeg" | "png" | "webp" | "avif";

export const KIND_TO_EXTENSION = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
} as const satisfies Record<ImageKind, string>;

export const KIND_TO_MIME = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
} as const satisfies Record<ImageKind, string>;

/** Сколько первых байт достаточно для определения. */
export const SNIFF_BYTES = 64;

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end && i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] ?? 0);
  }
  return s;
}

export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  // WebP: "RIFF" .... "WEBP"
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";

  // AVIF: ISO-BMFF, бокс "ftyp" с брендом avif/avis (основной или совместимым)
  if (ascii(bytes, 4, 8) === "ftyp") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const boxSize = Math.min(view.getUint32(0, false), bytes.length);
    const brands = [ascii(bytes, 8, 12)];
    for (let i = 16; i + 4 <= boxSize; i += 4) brands.push(ascii(bytes, i, i + 4));
    if (brands.some((b) => b === "avif" || b === "avis")) return "avif";
  }

  return null;
}
