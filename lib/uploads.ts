/**
 * Общие константы и правила загрузки изображений (используются и на клиенте
 * для предварительной проверки, и на сервере как окончательная проверка).
 */

export const IMAGE_EXTENSIONS = ["jpg", "png", "webp", "avif"] as const;
export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

export const MIME_TO_EXTENSION: Record<string, ImageExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export const EXTENSION_TO_MIME: Record<ImageExtension, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export const MEMORIES_BUCKET = "memories";

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 МБ (лимит bucket — 15 МБ)
export const MAX_THUMB_BYTES = 2 * 1024 * 1024; // 2 МБ
export const MAX_FILES_PER_BATCH = 20;
export const THUMB_MAX_SIDE = 960;

export const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp,image/avif";

/** Пути объектов строятся ТОЛЬКО на сервере из id пользователя и uploadId. */
export function originalObjectPath(
  userId: string,
  uploadId: string,
  ext: ImageExtension,
): string {
  return `${userId}/${uploadId}.${ext}`;
}

export function thumbObjectPath(userId: string, uploadId: string): string {
  return `${userId}/${uploadId}_thumb.webp`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
