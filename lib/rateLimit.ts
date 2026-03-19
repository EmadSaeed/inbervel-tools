// Simple in-memory rate limiter for OTP endpoints.
//
// Limits a given key (email address) to MAX_REQUESTS within a WINDOW_MS window.
// On serverless platforms (Vercel) each cold start resets the counter — for
// true persistence across invocations, swap the Map for @upstash/ratelimit +
// @upstash/redis.

const WINDOW_MS = 10 * 60 * 1000; // 10-minute window
const MAX_REQUESTS = 5;            // max OTP requests per window

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the window resets (only meaningful when allowed=false). */
  retryAfterMs: number;
}

/**
 * Check and increment the rate limit counter for the given key.
 * Returns `{ allowed: true }` when the request is within limits,
 * or `{ allowed: false, retryAfterMs }` when the limit is exceeded.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}
