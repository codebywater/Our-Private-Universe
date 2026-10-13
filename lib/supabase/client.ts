import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Браузерный клиент. Используется ТОЛЬКО для загрузки файлов по одноразовым
 * signed upload URL, которые выдаёт сервер после проверок. Вся остальная
 * работа с данными идёт через серверные действия.
 */
export function createClient() {
  const { url, key } = assertSupabaseConfigured();
  return createBrowserClient<Database>(url, key);
}
