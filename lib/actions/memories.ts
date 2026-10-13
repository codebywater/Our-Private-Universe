"use server";

import { revalidatePath } from "next/cache";
import { runAction, validationFailure } from "@/lib/actions/guard";
import { failure, success, type ActionResult } from "@/lib/actions/result";
import {
  fetchMemoriesPage,
  fetchMemoryOriginalUrl,
  type MemoriesPage,
} from "@/lib/data/memories";
import { removeObjects } from "@/lib/data/media";
import { UploadVerificationError, verifyUploadRef } from "@/lib/data/upload-verify";
import { createClient } from "@/lib/supabase/server";
import { idInputSchema } from "@/lib/validations/common";
import {
  createMemorySchema,
  listMemoriesSchema,
  updateMemorySchema,
  type CreateMemoryInput,
  type UpdateMemoryInput,
} from "@/lib/validations/memory";

/** Подгрузка следующей страницы (бесконечная прокрутка). */
export async function loadMoreMemories(input: {
  category?: string;
  year?: number;
  cursor?: { date: string; id: string } | null;
}): Promise<ActionResult<MemoriesPage>> {
  return runAction("loadMoreMemories", async () => {
    const parsed = listMemoriesSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const page = await fetchMemoriesPage(parsed.data);
    return success(page);
  });
}

/** Ссылка на оригинал для полноэкранного просмотра (живёт 10 минут). */
export async function getMemoryOriginalUrl(input: {
  id: string;
}): Promise<ActionResult<{ url: string }>> {
  return runAction("getMemoryOriginalUrl", async () => {
    const parsed = idInputSchema.safeParse(input);
    if (!parsed.success) return failure("Некорректный запрос.", { code: "validation" });
    const url = await fetchMemoryOriginalUrl(parsed.data.id);
    if (!url) return failure("Фотография недоступна.", { code: "not_found" });
    return success({ url });
  });
}

export async function createMemory(
  input: CreateMemoryInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction("createMemory", async ({ member }) => {
    const parsed = createMemorySchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;

    const supabase = await createClient();

    let verified;
    try {
      verified = await verifyUploadRef(supabase, member, data.upload);
    } catch (error) {
      if (error instanceof UploadVerificationError) {
        return failure(error.userMessage);
      }
      throw error;
    }

    const { data: row, error } = await supabase
      .from("memories")
      .insert({
        title: data.title,
        caption: data.caption,
        memory_date: data.memoryDate,
        category: data.category,
        image_path: verified.imagePath,
        thumb_path: verified.thumbPath,
        width: data.width ?? null,
        height: data.height ?? null,
        // Автор — всегда текущий пользователь из сессии
        created_by: member.id,
      })
      .select("id")
      .single();

    if (error || !row) {
      // Запись не создалась — не оставляем «осиротевшие» файлы
      await removeObjects(supabase, [verified.imagePath, verified.thumbPath]);
      console.error("[action:createMemory] insert failed", { code: error?.code });
      return failure("Не удалось сохранить воспоминание. Попробуйте ещё раз.");
    }

    revalidatePath("/memories");
    revalidatePath("/archive");
    return success({ id: row.id });
  });
}

export async function updateMemory(input: UpdateMemoryInput): Promise<ActionResult> {
  return runAction("updateMemory", async () => {
    const parsed = updateMemorySchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { id, title, caption, memoryDate, category } = parsed.data;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("memories")
      .update({ title, caption, memory_date: memoryDate, category })
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("[action:updateMemory] update failed", { code: error.code });
      return failure("Не удалось сохранить изменения.");
    }
    if (!data || data.length === 0) {
      return failure("Воспоминание не найдено.", { code: "not_found" });
    }

    // Список на клиенте обновляется локально (без сброса пагинации).
    return success();
  });
}

/**
 * Удаление: сначала файлы, потом запись. Если Storage недоступен — запись
 * остаётся нетронутой, и можно повторить попытку (операция идемпотентна:
 * повторное удаление уже отсутствующих файлов не считается ошибкой).
 */
export async function deleteMemory(input: { id: string }): Promise<ActionResult> {
  return runAction("deleteMemory", async () => {
    const parsed = idInputSchema.safeParse(input);
    if (!parsed.success) return failure("Некорректный запрос.", { code: "validation" });

    const supabase = await createClient();
    const { data: row, error: readError } = await supabase
      .from("memories")
      .select("id, image_path, thumb_path")
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (readError) {
      return failure("Не удалось найти воспоминание. Попробуйте ещё раз.");
    }
    if (!row) return failure("Воспоминание уже удалено.", { code: "not_found" });

    const removed = await removeObjects(supabase, [row.image_path, row.thumb_path]);
    if (!removed.ok) {
      return failure(
        "Не удалось удалить файл из хранилища. Воспоминание сохранено — попробуйте ещё раз.",
      );
    }

    const { error: deleteError } = await supabase
      .from("memories")
      .delete()
      .eq("id", row.id);
    if (deleteError) {
      console.error("[action:deleteMemory] delete failed", { code: deleteError.code });
      return failure(
        "Файл удалён, но запись не удалась. Повторите удаление, чтобы завершить.",
      );
    }

    // /memories обновляется на клиенте локально; счётчики архива — здесь.
    revalidatePath("/archive");
    return success();
  });
}
