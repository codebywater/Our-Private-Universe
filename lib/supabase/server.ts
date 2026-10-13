import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Серверный клиент, работающий от имени пользователя (его JWT из cookies).
 * Все запросы проходят через RLS. Ключ service_role не используется.
 */
export async function createClient() {
  const { url, key } = assertSupabaseConfigured();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Вызов из Server Component: cookies там менять нельзя.
          // Сессию обновляет proxy.ts, так что это безопасно игнорировать.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
