/**
 * Fixed-window rate limiter voor de externe availability-API (US-H5).
 * Bewust een apart, simpel mechanisme i.p.v. hergebruik van
 * src/lib/auth/rateLimit.ts: die is een "N mislukte pogingen -> lockout
 * van X minuten"-limiter (login-semantiek); dit hier is "max N aanroepen
 * per vast tijdvenster, daarna reset" — een andere semantiek.
 * In-memory, per-instance — zelfde gedocumenteerde grens als de
 * login-rate-limiter (zie Technical_Debt.md).
 */

type Entry = { windowStart: number; count: number };

const store = new Map<string, Entry>();

export type RateLimitResult = { limited: boolean; retryAfterSeconds?: number };

export function checkAndRecordRequest(
  key: string,
  maxPerWindow: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { windowStart: now, count: 1 });
    return { limited: false };
  }

  if (entry.count >= maxPerWindow) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.windowStart + windowMs - now) / 1000) };
  }

  entry.count += 1;
  return { limited: false };
}

/** Uitsluitend voor tests: leegt de volledige in-memory store. */
export function __clearApiRateLimitStoreForTests(): void {
  store.clear();
}
