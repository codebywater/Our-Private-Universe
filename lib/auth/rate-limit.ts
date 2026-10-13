import "server-only";
import {
  createSlidingWindowLimiter,
  type LimitResult,
} from "@/lib/utils/sliding-window";

/**
 * «Мягкий» рубеж перед отправкой писем авторизации (счётчик в памяти процесса).
 *
 * Ограничение: на serverless у каждого экземпляра функции своя память, поэтому
 * лимит приблизительный. Основная защита — встроенные лимиты Supabase Auth
 * (Authentication → Rate Limits); настройте их, см. README.
 */
const limiter = createSlidingWindowLimiter();

export function rateLimit(key: string, limit: number, windowMs: number): LimitResult {
  return limiter.check(key, limit, windowMs);
}
