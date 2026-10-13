import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { AccessDeniedError, requireMemberForAction, type Member } from "@/lib/auth/session";
import { failure, type ActionResult } from "@/lib/actions/result";

/** Первое сообщение об ошибке для каждого поля. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Ошибка валидации входных данных → ActionResult. */
export function validationFailure(error: z.ZodError): ActionResult<never> {
  return failure("Проверьте заполнение полей.", {
    fieldErrors: fieldErrorsFrom(error),
    code: "validation",
  });
}

/**
 * Обёртка для серверных действий: проверка доступа (сессия + allowlist),
 * безопасная обработка ошибок и логирование без персональных данных.
 *
 * В логи пишется только название действия и код ошибки — НИКОГДА тексты
 * писем, названия, токены или сообщения БД (в них бывают значения полей).
 */
export async function runAction<T>(
  name: string,
  fn: (ctx: { member: Member }) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const member = await requireMemberForAction();
    return await fn({ member });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return failure("Сессия истекла. Войдите снова.", { code: "unauthorized" });
    }
    unstable_rethrow(error); // пропускаем redirect()/notFound()
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "n/a";
    console.error(`[action:${name}] failed`, { code });
    return failure("Что-то пошло не так. Попробуйте ещё раз.", { code: "unknown" });
  }
}
