import "server-only";
import { headers } from "next/headers";

/**
 * Counts attempts per key in a fixed window, in memory. The shop runs as one
 * server process, so that is enough to stop password guessing and form
 * spam; a restart simply starts the counts over.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export const LIMITS = {
  /** Wrong passwords for one e-mail address. */
  loginPerEmail: { max: 5, windowMs: 15 * 60_000 },
  /** Wrong passwords from one network address, across all accounts. */
  loginPerIp: { max: 30, windowMs: 15 * 60_000 },
  registerPerIp: { max: 5, windowMs: 60 * 60_000 },
  resetPerIp: { max: 10, windowMs: 60 * 60_000 },
} as const;

type Limit = { max: number; windowMs: number };

function bucket(key: string, limit: Limit): Bucket {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + limit.windowMs };
    buckets.set(key, b);
  }
  // Keep the map from growing without bound.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  return b;
}

/** Minutes until the key may try again, or 0 when it isn't blocked. */
export function blockedFor(key: string, limit: Limit): number {
  const b = bucket(key, limit);
  return b.count >= limit.max ? Math.ceil((b.resetAt - Date.now()) / 60_000) : 0;
}

export function recordAttempt(key: string, limit: Limit): void {
  bucket(key, limit).count++;
}

export function clearAttempts(key: string): void {
  buckets.delete(key);
}

/** The visitor's address as seen by the server (first hop when behind a proxy). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
