"use server";

import { runAction, validationFailure } from "@/lib/actions/guard";
import { failure, success, type ActionResult } from "@/lib/actions/result";
import { removeObjects } from "@/lib/data/media";
import { createClient } from "@/lib/supabase/server";
import {
  MEMORIES_BUCKET,
  MIME_TO_EXTENSION,
  originalObjectPath,
  thumbObjectPath,
  type ImageExtension,
} from "@/lib/uploads";
import {
  prepareUploadSchema,
  uploadRefSchema,
  type PrepareUploadInput,
  type UploadRef,
} from "@/lib/validations/upload";

export type PreparedUpload = {
  uploadId: string;
  ext: ImageExtension;
  path: string;
  token: string;
  thumbPath: string | null;
  thumbToken: string | null;
};

/**
 * Шаг 1 загрузки: сервер проверяет права и параметры, САМ выбирает путь
 * (<user_id>/<случайный uuid>.<ext>) и выдаёт одноразовые подписанные URL
 * для загрузки. Клиент не может выбрать имя файла или чужую папку.
 *
 * Файлы грузятся напрямую в Storage (в обход лимита тела запроса serverless
 * функций), а затем проверяются на сервере в verifyUploadRef().
 */
export async function prepareUpload(
  input: PrepareUploadInput,
): Promise<ActionResult<PreparedUpload>> {
  return runAction("prepareUpload", async ({ member }) => {
    const parsed = prepareUploadSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);

    const ext = MIME_TO_EXTENSION[parsed.data.mime];
    if (!ext) return failure("Неподдерживаемый формат файла.");

    const uploadId = crypto.randomUUID();
    const path = originalObjectPath(member.id, uploadId, ext);
    const thumbPath = parsed.data.withThumb ? thumbObjectPath(member.id, uploadId) : null;

    const supabase = await createClient();
    const storage = supabase.storage.from(MEMORIES_BUCKET);

    const main = await storage.createSignedUploadUrl(path);
    if (main.error || !main.data) {
      return failure("Не удалось подготовить загрузку. Попробуйте ещё раз.");
    }

    let thumbToken: string | null = null;
    if (thumbPath) {
      const thumb = await storage.createSignedUploadUrl(thumbPath);
      if (thumb.error || !thumb.data) {
        return failure("Не удалось подготовить загрузку превью.");
      }
      thumbToken = thumb.data.token;
    }

    return success({
      uploadId,
      ext,
      path,
      token: main.data.token,
      thumbPath,
      thumbToken,
    });
  });
}

/** Откат неудачной/отменённой загрузки: удаляем уже залитые объекты. */
export async function discardUpload(input: UploadRef): Promise<ActionResult> {
  return runAction("discardUpload", async ({ member }) => {
    const parsed = uploadRefSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);

    const supabase = await createClient();
    // Пути строятся из id ТЕКУЩЕГО пользователя — чужие файлы затронуть нельзя.
    await removeObjects(supabase, [
      originalObjectPath(member.id, parsed.data.uploadId, parsed.data.ext),
      thumbObjectPath(member.id, parsed.data.uploadId),
    ]);
    return success();
  });
}
