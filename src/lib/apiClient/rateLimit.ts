/**
 * Rate limiter voor de externe availability-API (US-H5, FR-8.6).
 *
 * Post-v1 (akkoord PO 2026-09-28): Postgres-backed i.p.v. in-memory, zodat
 * de limiet over alle (Vercel-)instanties heen geldt en een herstart hem
 * niet reset. Er is GEEN aparte tabel: elke aanroep wordt al gelogd in
 * `audit_log` (entity_type 'api_client', action 'availability_api_call',
 * payload.statusCode — zie externalAvailabilityService.logApiCall). De
 * limiter telt die rijen in een glijdend venster.
 *
 * - Aanroepen die zelf met 429 geweigerd zijn tellen NIET mee (een
 *   geweigerde aanroep verbruikt geen quotum; anders blijft een client die
 *   blijft aandringen eeuwig geblokkeerd).
 * - Grens: een aanroep wordt pas aan het eind van de request gelogd. Bij
 *   gelijktijdige (in-flight) requests van dezelfde client kan de limiet
 *   dus met maximaal het aantal gelijktijdige requests overschreden worden.
 *   Bewust geaccepteerd (zie Technical_Debt.md) — exact afdwingen vereist
 *   een reservering vóór de request, d.w.z. een extra schrijfactie per call.
 */
import { prisma } from "@/lib/prisma";

export type RateLimitResult = { limited: boolean; retryAfterSeconds?: number };

export const API_CALL_AUDIT_ENTITY_TYPE = "api_client";
export const API_CALL_AUDIT_ACTION = "availability_api_call";

/**
 * Pure beslislogica voor een glijdend venster.
 * @param recentCallsNewestFirst tijdstippen van meegetelde aanroepen binnen
 *   het venster, nieuwste eerst (hoeft er niet meer dan `maxPerWindow` te bevatten).
 */
export function evaluateSlidingWindow(
  recentCallsNewestFirst: Date[],
  maxPerWindow: number,
  windowMs: number,
  now: Date,
): RateLimitResult {
  if (maxPerWindow <= 0) {
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)) };
  }
  if (recentCallsNewestFirst.length < maxPerWindow) {
    return { limited: false };
  }
  // De limiet is bereikt. Er is weer ruimte zodra de max-ste nieuwste
  // aanroep uit het venster valt.
  const oldestCounted = recentCallsNewestFirst[maxPerWindow - 1]!;
  const retryAtMs = oldestCounted.getTime() + windowMs;
  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil((retryAtMs - now.getTime()) / 1000)),
  };
}

export async function checkApiRateLimit(
  apiClientId: string,
  maxPerWindow: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const recent = await prisma.auditLog.findMany({
    where: {
      entityType: API_CALL_AUDIT_ENTITY_TYPE,
      entityId: apiClientId,
      action: API_CALL_AUDIT_ACTION,
      createdAt: { gt: new Date(now.getTime() - windowMs) },
      NOT: { payload: { path: ["statusCode"], equals: 429 } },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: Math.max(maxPerWindow, 1),
  });
  return evaluateSlidingWindow(
    recent.map((row) => row.createdAt),
    maxPerWindow,
    windowMs,
    now,
  );
}
