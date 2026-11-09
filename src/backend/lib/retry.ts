// Retry policy for CMS REST API calls. Pure, so it is unit-tested (retry.test.ts).
// The CMS rate-limits with HTTP 429. Keep total waiting small: a whole invokeFunction call
// must finish within ~59 s.

export const MAX_RETRIES = 3;
export const MAX_RETRY_WAIT_MS = 3_000;
export const RETRY_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

export function shouldRetry(status: number, attempt: number): boolean {
  return RETRY_STATUSES.has(status) && attempt < MAX_RETRIES;
}

/**
 * Delay before retry number `attempt` (0-based): the server's Retry-After (seconds) when given,
 * otherwise exponential backoff (500 ms, 1 s, 2 s…), plus up to 250 ms jitter, capped.
 */
export function retryDelayMs(retryAfter: string | null, attempt: number, random: () => number = Math.random): number {
  const seconds = retryAfter !== null && retryAfter.trim() !== '' ? Number(retryAfter) : NaN;
  const base = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 500 * 2 ** attempt;
  return Math.min(MAX_RETRY_WAIT_MS, base + Math.floor(random() * 250));
}
