/**
 * In-memory sliding-window rate limiter for API endpoints.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  let b = buckets.get(key);
  if (!b) {
    b = { timestamps: [] };
    buckets.set(key, b);
  }
  b.timestamps = b.timestamps.filter((t) => t > cutoff);
  if (b.timestamps.length >= maxRequests) {
    const oldest = b.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  b.timestamps.push(now);
  return { allowed: true, retryAfterSec: 0 };
}

export function resetRateLimits(): void {
  buckets.clear();
}
