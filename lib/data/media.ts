import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { MEMORIES_BUCKET } from "@/lib/uploads";

/** Время жизни временных ссылок (секунды). */
export const SIGNED_URL_TTL = {
  /** превью в сетках и на timeline */
  thumb: 60 * 60,
  /** оригинал в полноэкранной галерее */
  original: 10 * 60,
} as const;

/**
 * Выдаёт временные signed URL для приватных файлов.
 * Запрос идёт под сессией пользователя, поэтому подпись возможна только если
 * проходит SELECT-политика Storage (участник allowlist). Публичных ссылок нет.
 */
export async function signUrls(
  supabase: ServerSupabase,
  paths: ReadonlyArray<string | null | undefined>,
  ttlSeconds: number,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  const { data, error } = await supabase.storage
    .from(MEMORIES_BUCKET)
    .createSignedUrls(unique, ttlSeconds);

  if (error || !data) return result;
  for (const item of data) {
    if (!item.error && item.path && item.signedUrl) {
      result.set(item.path, item.signedUrl);
    }
  }
  return result;
}

/** Удаление объектов Storage. Отсутствующие файлы не считаются ошибкой. */
export async function removeObjects(
  supabase: ServerSupabase,
  paths: ReadonlyArray<string | null | undefined>,
): Promise<{ ok: boolean }> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length === 0) return { ok: true };

  const { error } = await supabase.storage.from(MEMORIES_BUCKET).remove(unique);
  if (error) {
    console.error("[storage] remove failed", { count: unique.length });
    return { ok: false };
  }
  return { ok: true };
}
