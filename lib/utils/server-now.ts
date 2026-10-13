import "server-only";

/** Текущее время сервера в секундах — для первого рендера счётчика. */
export function serverNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
