/**
 * Request rate limiting (M-06 fix).
 *
 * Nothing throttled any endpoint before: attendance sheets could be flooded
 * with forged entries and the D1 quota could be drained by a simple loop.
 *
 * This is a per-isolate sliding-window counter. It is deliberately cheap — a
 * Cloudflare Worker has no shared memory, so limits are approximate and reset
 * when an isolate is recycled. That is enough to stop casual abuse and slow
 * automated scraping, but a determined distributed attack needs Cloudflare's
 * WAF rate-limiting rules in front of this.
 */

interface Window {
  hits: number[];
}

const windows = new Map<string, Window>();

/** Hard cap on tracked keys so a spoofed-IP flood cannot exhaust memory. */
const MAX_TRACKED_KEYS = 10_000;
const PRUNE_INTERVAL_MS = 60_000;
let lastPrune = Date.now();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the caller may retry, when throttled. */
  retryAfter: number;
  limit: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  prune(now);

  const window = windows.get(key) ?? { hits: [] };
  const cutoff = now - windowMs;
  window.hits = window.hits.filter((time) => time > cutoff);

  if (window.hits.length >= limit) {
    windows.set(key, window);
    const retryAfter = Math.max(1, Math.ceil((window.hits[0] + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfter, limit };
  }

  window.hits.push(now);
  windows.set(key, window);
  return { allowed: true, remaining: limit - window.hits.length, retryAfter: 0, limit };
}

function prune(now: number): void {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, window] of windows) {
    if (window.hits.length === 0 || window.hits[window.hits.length - 1] < now - 3_600_000) {
      windows.delete(key);
    }
  }
  // Evict oldest entries if still over the cap.
  if (windows.size > MAX_TRACKED_KEYS) {
    const excess = windows.size - MAX_TRACKED_KEYS;
    let removed = 0;
    for (const key of windows.keys()) {
      if (removed >= excess) break;
      windows.delete(key);
      removed += 1;
    }
  }
}

/**
 * Identify a caller.
 *
 * Authenticated users are bucketed by user id so a shared NAT does not punish
 * a whole school behind one IP; anonymous traffic falls back to the IP.
 */
export function clientKey(request: Request, userId?: number | null): string {
  if (userId != null) return `u:${userId}`;
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  return `ip:${ip}`;
}

/** Limits per request class. */
export const LIMITS = {
  /** Login attempts: generous enough for retries, tight enough to stop spraying. */
  auth: { limit: 20, windowMs: 60_000 },
  /** Any state-changing call. */
  mutation: { limit: 60, windowMs: 60_000 },
  /** Reads. */
  read: { limit: 300, windowMs: 60_000 },
  /** Public attendance endpoint: guests are anonymous, so keep it tight. */
  attend: { limit: 10, windowMs: 60_000 },
} as const;
