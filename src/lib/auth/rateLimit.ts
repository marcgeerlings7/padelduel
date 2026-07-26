/**
 * In-memory rate limiter voor het login-endpoint (US-A3). Per-instance:
 * telling reset bij een herstart of bij meerdere app-instanties. Voor de
 * pilotschaal (PRD §13, 1 regio/~20 duo's, single-instance deployment) is
 * dit een bewuste, gedocumenteerde keuze — bij opschalen naar meerdere
 * instanties moet dit vervangen worden door een gedeelde store (bijv.
 * Redis). Zie sprint-review technical debt.
 */

type Entry = {
  failedAttempts: number;
  lockedUntil: number | null;
};

const store = new Map<string, Entry>();

export type RateLimitStatus =
  | { limited: false }
  | { limited: true; retryAfterSeconds: number };

export function checkRateLimit(key: string): RateLimitStatus {
  const entry = store.get(key);
  if (!entry || !entry.lockedUntil) {
    return { limited: false };
  }
  const now = Date.now();
  if (now >= entry.lockedUntil) {
    store.delete(key);
    return { limited: false };
  }
  return { limited: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
}

export function recordFailedAttempt(
  key: string,
  maxAttempts: number,
  lockoutMinutes: number,
): void {
  const entry = store.get(key) ?? { failedAttempts: 0, lockedUntil: null };
  entry.failedAttempts += 1;
  if (entry.failedAttempts >= maxAttempts) {
    entry.lockedUntil = Date.now() + lockoutMinutes * 60_000;
  }
  store.set(key, entry);
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

/** Uitsluitend voor tests: leegt de volledige in-memory store. */
export function __clearRateLimitStoreForTests(): void {
  store.clear();
}
