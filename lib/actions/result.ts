/**
 * Единый формат результата серверных действий.
 * Модуль без директивы "use server": его типы и хелперы можно импортировать
 * и из клиентских, и из серверных файлов.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      code?: "unauthorized" | "rate_limited" | "validation" | "not_found" | "unknown";
    };

export function success(): ActionResult<undefined>;
export function success<T>(data: T): ActionResult<T>;
export function success<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function failure(
  error: string,
  extra?: {
    fieldErrors?: Record<string, string>;
    code?: "unauthorized" | "rate_limited" | "validation" | "not_found" | "unknown";
  },
): ActionResult<never> {
  return { ok: false, error, ...extra };
}
