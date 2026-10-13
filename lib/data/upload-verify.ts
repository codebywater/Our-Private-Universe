import "server-only";
import type { Member } from "@/lib/auth/session";
import { removeObjects } from "@/lib/data/media";
import type { ServerSupabase } from "@/lib/supabase/server";
import {
  MAX_IMAGE_BYTES,
  MAX_THUMB_BYTES,
  MEMORIES_BUCKET,
  originalObjectPath,
  thumbObjectPath,
} from "@/lib/uploads";
import { KIND_TO_EXTENSION, SNIFF_BYTES, sniffImage, type ImageKind } from "@/lib/utils/image-sniff";
import type { UploadRef } from "@/lib/validations/upload";

export class UploadVerificationError extends Error {
  constructor(public userMessage: string) {
    super("upload_verification_failed");
    this.name = "UploadVerificationError";
  }
}

type Inspection = { size: number; kind: ImageKind | null };

/** Читает только первые байты объекта (через Range) и определяет тип по сигнатуре. */
async function inspectObject(
  supabase: ServerSupabase,
  path: string,
): Promise<Inspection | null> {
  const storage = supabase.storage.from(MEMORIES_BUCKET);

  const { data: info, error: infoError } = await storage.info(path);
  if (infoError || !info) return null;

  const { data: signed, error: signError } = await storage.createSignedUrl(path, 60);
  if (signError || !signed) return null;

  const response = await fetch(signed.signedUrl, {
    headers: { Range: `bytes=0-${SNIFF_BYTES - 1}` },
    cache: "no-store",
  });
  if (!response.ok || !response.body) return null;

  // Если сервер проигнорировал Range и отдаёт файл целиком, читаем лишь начало.
  const reader = response.body.getReader();
  const head = new Uint8Array(SNIFF_BYTES);
  let filled = 0;
  while (filled < SNIFF_BYTES) {
    const { value, done } = await reader.read();
    if (done || !value) break;
    const take = Math.min(value.length, SNIFF_BYTES - filled);
    head.set(value.subarray(0, take), filled);
    filled += take;
  }
  await reader.cancel().catch(() => undefined);

  return { size: info.size ?? 0, kind: sniffImage(head.subarray(0, filled)) };
}

export type VerifiedUpload = {
  imagePath: string;
  thumbPath: string | null;
};

/**
 * Окончательная проверка загруженного файла на сервере — НЕ доверяем
 * Content-Type браузера и расширению:
 *   - файл действительно существует в папке текущего пользователя;
 *   - сигнатура (magic bytes) = JPEG/PNG/WebP/AVIF и совпадает с расширением;
 *   - размер в пределах лимита;
 *   - превью (если есть) — настоящий WebP небольшого размера.
 * При любом несоответствии оба объекта удаляются.
 */
export async function verifyUploadRef(
  supabase: ServerSupabase,
  member: Member,
  ref: UploadRef,
): Promise<VerifiedUpload> {
  const imagePath = originalObjectPath(member.id, ref.uploadId, ref.ext);
  const thumbPath = ref.hasThumb ? thumbObjectPath(member.id, ref.uploadId) : null;

  const reject = async (message: string): Promise<never> => {
    await removeObjects(supabase, [imagePath, thumbPath]);
    throw new UploadVerificationError(message);
  };

  const original = await inspectObject(supabase, imagePath);
  if (!original) {
    return reject("Файл не найден в хранилище. Попробуйте загрузить его ещё раз.");
  }
  if (!original.kind || KIND_TO_EXTENSION[original.kind] !== ref.ext) {
    return reject("Файл не похож на изображение допустимого формата (JPEG, PNG, WebP, AVIF).");
  }
  if (original.size <= 0 || original.size > MAX_IMAGE_BYTES) {
    return reject("Файл слишком большой (максимум 12 МБ).");
  }

  if (thumbPath) {
    const thumb = await inspectObject(supabase, thumbPath);
    if (!thumb || thumb.kind !== "webp" || thumb.size > MAX_THUMB_BYTES) {
      return reject("Не удалось обработать превью. Попробуйте загрузить файл ещё раз.");
    }
  }

  return { imagePath, thumbPath };
}
