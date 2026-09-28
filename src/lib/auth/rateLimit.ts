/**
 * Rate limiter voor het login-endpoint (US-A3).
 *
 * Post-v1 (akkoord PO 2026-09-28): Postgres-backed i.p.v. in-memory, zodat
 * de limiet over alle (Vercel-)instanties heen geldt en een herstart hem
 * niet reset. Zonder schemawijziging: mislukte pogingen worden als rij in
 * `audit_log` vastgelegd (entity_type 'login_rate_limit', action
 * 'login_failed'); een geslaagde login schrijft een reset-marker (action
 * 'login_rate_limit_reset'). `entity_id` is een deterministische UUID
 * afgeleid van een SHA-256 van de rate-limit-key (e-mail + IP) — het
 * e-mailadres/IP zelf wordt dus NIET opgeslagen.
 *
 * Semantiek (glijdend venster, window = login_lockout_minutes): zijn er
 * sinds de laatste geslaagde login binnen het venster ≥ login_max_attempts
 * mislukte pogingen, dan is de key geblokkeerd totdat de oudste daarvan
 * uit het venster valt. Geblokkeerde pogingen worden niet geteld (de
 * wachtwoordcontrole wordt dan niet eens uitgevoerd), dus effectief:
 * "maximaal N mislukte pogingen per `login_lockout_minutes` per key".
 * Verschil met de oude in-memory limiter: mislukte pogingen verlopen nu
 * vanzelf na het venster (voorheen telden ze door tot een geslaagde login).
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const LOGIN_RATE_LIMIT_ENTITY_TYPE = "login_rate_limit";
export const LOGIN_FAILED_ACTION = "login_failed";
export const LOGIN_RESET_ACTION = "login_rate_limit_reset";

/** Veiligheidsgrens op het aantal gelezen rijen per check. */
const MAX_EVENTS_READ = 200;

export type RateLimitStatus =
  | { limited: false; failedAttempts: number }
  | { limited: true; retryAfterSeconds: number; failedAttempts: number };

export type LoginRateLimitEvent = { action: string; createdAt: Date };

/** Deterministische UUID (v4-vorm) uit een SHA-256 van de key — geen PII in de database. */
export function rateLimitKeyToEntityId(key: string): string {
  const hex = createHash("sha256").update(`login-rate-limit:${key}`).digest("hex");
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Pure beslislogica.
 * @param eventsNewestFirst events binnen het venster, nieuwste eerst.
 */
export function evaluateLoginLockout(
  eventsNewestFirst: LoginRateLimitEvent[],
  maxAttempts: number,
  lockoutMinutes: number,
  now: Date,
): RateLimitStatus {
  const failures: Date[] = [];
  for (const event of eventsNewestFirst) {
    if (event.action === LOGIN_RESET_ACTION) break; // alles daarvóór is gereset
    if (event.action === LOGIN_FAILED_ACTION) failures.push(event.createdAt);
  }

  if (failures.length < maxAttempts) {
    return { limited: false, failedAttempts: failures.length };
  }

  const lockoutMs = lockoutMinutes * 60_000;
  const oldestCounted = failures[maxAttempts - 1]!; // nieuwste-eerst: de max-ste nieuwste
  const retryAtMs = oldestCounted.getTime() + lockoutMs;
  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil((retryAtMs - now.getTime()) / 1000)),
    failedAttempts: failures.length,
  };
}

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  lockoutMinutes: number,
): Promise<RateLimitStatus> {
  const now = new Date();
  const events = await prisma.auditLog.findMany({
    where: {
      entityType: LOGIN_RATE_LIMIT_ENTITY_TYPE,
      entityId: rateLimitKeyToEntityId(key),
      createdAt: { gt: new Date(now.getTime() - lockoutMinutes * 60_000) },
    },
    select: { action: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: MAX_EVENTS_READ,
  });
  return evaluateLoginLockout(events, maxAttempts, lockoutMinutes, now);
}

async function recordEvent(key: string, action: string): Promise<void> {
  await prisma.auditLog.create({
    data: {
      entityType: LOGIN_RATE_LIMIT_ENTITY_TYPE,
      entityId: rateLimitKeyToEntityId(key),
      action,
      performedBy: null,
    },
  });
}

export async function recordFailedAttempt(key: string): Promise<void> {
  await recordEvent(key, LOGIN_FAILED_ACTION);
}

export async function resetRateLimit(key: string): Promise<void> {
  await recordEvent(key, LOGIN_RESET_ACTION);
}
