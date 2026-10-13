"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { validationFailure } from "@/lib/actions/guard";
import { failure, type ActionResult } from "@/lib/actions/result";
import { rateLimit } from "@/lib/auth/rate-limit";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils/safe-redirect";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

const WINDOW_MS = 10 * 60 * 1000;

// Одно и то же сообщение для неверного пароля, несуществующего email и
// аккаунта вне allowlist: форма не должна подсказывать, кто есть в списке.
const BAD_CREDENTIALS = "Неверный email или пароль.";

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

function formatWait(seconds: number): string {
  if (seconds < 90) return `${seconds} сек.`;
  return `${Math.ceil(seconds / 60)} мин.`;
}

/** Вход по email и паролю. Регистрации нет: аккаунты создаёт владелец проекта. */
export async function signInWithPassword(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  if (!isSupabaseConfigured) {
    return failure(
      "Сервер ещё не подключён к Supabase. Заполните переменные окружения (см. README).",
    );
  }

  const { email, password } = parsed.data;
  const ip = await clientIp();

  // Мягкий рубеж перед Supabase (счётчик в памяти процесса; основная защита —
  // лимиты Supabase Auth). Считаем все попытки, а не только неудачные.
  const byEmail = rateLimit(`login:email:${email}`, 8, WINDOW_MS);
  const byIp = rateLimit(`login:ip:${ip}`, 20, WINDOW_MS);
  if (!byEmail.allowed || !byIp.allowed) {
    const wait = Math.max(byEmail.retryAfterSec, byIp.retryAfterSec);
    return failure(`Слишком много попыток. Повторите через ${formatWait(wait)}`, {
      code: "rate_limited",
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    if (error?.status === 429) {
      return failure("Слишком много попыток. Подождите немного и повторите.", {
        code: "rate_limited",
      });
    }
    // Пароль и email в лог не пишем
    console.error("[auth] sign-in failed", { status: error?.status, code: error?.code });
    return failure(BAD_CREDENTIALS);
  }

  // Сессия ≠ доступ: сразу проверяем allowlist.
  const { data: row } = await supabase
    .from("allowed_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!row) {
    await supabase.auth.signOut({ scope: "local" });
    return failure(BAD_CREDENTIALS, { code: "unauthorized" });
  }

  redirect(safeNextPath(parsed.data.next, "/"));
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    // Завершаем только текущую сессию, не все устройства
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login");
}
