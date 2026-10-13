/**
 * Защита от open redirect: допускаются только относительные пути внутри сайта.
 * Принимает значение параметра `next` из URL/формы и возвращает безопасный путь.
 */
export function safeNextPath(
  input: string | null | undefined,
  fallback = "/",
): string {
  if (typeof input !== "string" || input.length === 0 || input.length > 500) {
    return fallback;
  }
  // Только путь от корня; запрещаем "//host", "/\host" и управляющие символы
  if (!input.startsWith("/") || input.startsWith("//") || input.startsWith("/\\")) {
    return fallback;
  }
  if (/[\u0000-\u001f\u007f\\]/.test(input)) return fallback;

  try {
    const base = "http://internal.invalid";
    const url = new URL(input, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
