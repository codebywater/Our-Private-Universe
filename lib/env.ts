/**
 * Публичные переменные окружения.
 *
 * ВАЖНО: ссылки на process.env.NEXT_PUBLIC_* должны быть записаны буквально,
 * иначе Next.js не подставит значения в клиентский бандл.
 *
 * service_role-ключ приложению НЕ нужен и нигде не используется.
 */
import { siteConfig } from "@/lib/site-config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const publicEnv = {
  supabaseUrl: url ?? "",
  supabaseKey: key ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, ""),
  timezone: process.env.NEXT_PUBLIC_TIMEZONE || siteConfig.defaultTimezone,
} as const;

export const isSupabaseConfigured = Boolean(url && key);

/** Бросает понятную ошибку, если Supabase не настроен. */
export function assertSupabaseConfigured(): { url: string; key: string } {
  if (!url || !key) {
    throw new Error(
      "Supabase не настроен: задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (см. .env.example).",
    );
  }
  return { url, key };
}
