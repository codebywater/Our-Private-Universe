/**
 * Ограничитель частоты со скользящим окном (чистая логика, без зависимостей —
 * поэтому легко тестируется). Серверная обёртка: lib/auth/rate-limit.ts.
 */
export type LimitResult = { allowed: boolean; retryAfterSec: number };

export function createSlidingWindowLimiter(maxKeys = 5000) {
  const buckets = new Map<string, number[]>();

  function check(
    key: string,
    limit: number,
    windowMs: number,
    now: number = Date.now(),
  ): LimitResult {
    const cutoff = now - windowMs;
    const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);

    if (hits.length >= limit) {
      const oldest = hits[0] ?? now;
      buckets.set(key, hits);
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      };
    }

    hits.push(now);
    buckets.set(key, hits);

    // Защита от неограниченного роста памяти
    if (buckets.size > maxKeys) {
      for (const [k, v] of buckets) {
        if (v.every((t) => t <= cutoff)) buckets.delete(k);
        if (buckets.size <= maxKeys / 2) break;
      }
    }

    return { allowed: true, retryAfterSec: 0 };
  }

  return { check, reset: () => buckets.clear(), size: () => buckets.size };
}
