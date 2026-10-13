/**
 * Клиентская часть загрузки изображений (браузер):
 *  1. быстрая проверка: размер, сигнатура файла (magic bytes), чтение размеров;
 *  2. генерация лёгкого WebP-превью для сеток;
 *  3. загрузка оригинала и превью в приватный Storage по одноразовым подписанным
 *     URL, которые выдал сервер.
 * Это лишь предварительная проверка для удобства: окончательное решение
 * принимает сервер (verifyUploadRef).
 */
import { discardUpload, prepareUpload } from "@/lib/actions/uploads";
import { createClient } from "@/lib/supabase/client";
import {
  EXTENSION_TO_MIME,
  MAX_IMAGE_BYTES,
  MEMORIES_BUCKET,
  THUMB_MAX_SIDE,
  formatBytes,
  type ImageExtension,
} from "@/lib/uploads";
import {
  KIND_TO_EXTENSION,
  KIND_TO_MIME,
  SNIFF_BYTES,
  sniffImage,
} from "@/lib/utils/image-sniff";
import type { UploadRef } from "@/lib/validations/upload";

export type InspectedImage = {
  ext: ImageExtension;
  mime: string;
  width: number;
  height: number;
  /** null — браузер не смог создать WebP-превью; тогда грузим только оригинал. */
  thumb: Blob | null;
};

export type InspectResult =
  | { ok: true; image: InspectedImage }
  | { ok: false; error: string };

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function inspectImageFile(file: File): Promise<InspectResult> {
  if (file.size === 0) return { ok: false, error: "Файл пустой." };
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Файл слишком большой (${formatBytes(file.size)}, максимум ${formatBytes(MAX_IMAGE_BYTES)}).`,
    };
  }

  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  const kind = sniffImage(head);
  if (!kind) {
    return {
      ok: false,
      error:
        "Неподдерживаемый формат. Допустимы JPEG, PNG, WebP и AVIF (HEIC с iPhone сначала сохраните как JPEG).",
    };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    let thumb: Blob | null = null;
    try {
      const scale = Math.min(1, THUMB_MAX_SIDE / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await canvasToBlob(canvas, "image/webp", 0.82);
        // Некоторые браузеры молча отдают PNG вместо WebP — такое превью не берём.
        if (blob && blob.type === "image/webp") thumb = blob;
      }
    } finally {
      bitmap.close();
    }

    return {
      ok: true,
      image: {
        ext: KIND_TO_EXTENSION[kind],
        mime: KIND_TO_MIME[kind],
        width,
        height,
        thumb,
      },
    };
  } catch {
    return { ok: false, error: "Не удалось прочитать изображение. Файл повреждён?" };
  }
}

export type UploadedImage = {
  ref: UploadRef;
  width: number;
  height: number;
};

export type UploadOutcome =
  | { ok: true; uploaded: UploadedImage }
  | { ok: false; error: string };

/** Подготовка на сервере → загрузка в Storage. Метаданные сохраняет вызывающий. */
export async function uploadInspectedImage(
  file: File,
  image: InspectedImage,
): Promise<UploadOutcome> {
  const prepared = await prepareUpload({
    mime: image.mime,
    size: file.size,
    withThumb: image.thumb !== null,
  });
  if (!prepared.ok) return { ok: false, error: prepared.error };

  const { uploadId, ext, path, token, thumbPath, thumbToken } = prepared.data;
  const ref: UploadRef = { uploadId, ext, hasThumb: thumbPath !== null };

  const storage = createClient().storage.from(MEMORIES_BUCKET);

  const rollback = async (message: string): Promise<UploadOutcome> => {
    await discardUpload(ref).catch(() => undefined);
    return { ok: false, error: message };
  };

  try {
    const original = await storage.uploadToSignedUrl(path, token, file, {
      contentType: EXTENSION_TO_MIME[ext],
    });
    if (original.error) {
      return await rollback("Не удалось загрузить файл. Проверьте соединение и повторите.");
    }

    if (thumbPath && thumbToken && image.thumb) {
      const thumb = await storage.uploadToSignedUrl(thumbPath, thumbToken, image.thumb, {
        contentType: "image/webp",
      });
      if (thumb.error) {
        return await rollback("Не удалось загрузить превью. Повторите попытку.");
      }
    }
  } catch {
    return await rollback("Сеть недоступна. Повторите попытку позже.");
  }

  return { ok: true, uploaded: { ref, width: image.width, height: image.height } };
}

/** Название по умолчанию из имени файла. */
export function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.slice(0, 120);
}
