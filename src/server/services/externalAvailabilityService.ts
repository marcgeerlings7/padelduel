import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/apiClient/apiKey";
import { checkAndRecordRequest } from "@/lib/apiClient/rateLimit";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";

export class ExternalApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export type AuthenticatedApiClient = { id: string; regionId: string | null };

export async function authenticateApiKey(plaintextKey: string): Promise<AuthenticatedApiClient> {
  const keyHash = hashApiKey(plaintextKey);
  const client = await prisma.apiClient.findUnique({ where: { apiKeyHash: keyHash } });
  if (!client || !client.isActive) {
    throw new ExternalApiError("Ongeldige of ingetrokken API-key.", "invalid_api_key", 401);
  }
  return { id: client.id, regionId: client.regionId };
}

export async function enforceRateLimit(apiClientId: string): Promise<void> {
  const maxPerMinute = await getConfigNumber("availability_api_rate_limit_per_minute");
  const result = checkAndRecordRequest(apiClientId, maxPerMinute, 60_000);
  if (result.limited) {
    await logApiCall(apiClientId, "/api/v1/availability", 429);
    throw new ExternalApiError(
      "Rate limit overschreden.",
      "rate_limited",
      429,
      result.retryAfterSeconds,
    );
  }
}

/**
 * Geeft NOOIT persoonsgegevens terug (FR-8.4) — alleen duo-naam, regio en
 * tijdsblok. Bij een aan een regio gebonden client wordt de scope altijd
 * afgedwongen, ook als de aanroeper een andere regio opvraagt.
 */
export async function getPublicAvailability(
  client: AuthenticatedApiClient,
  filters: { regionSlug?: string; dayOfWeek?: number },
) {
  let regionId = client.regionId;
  if (!regionId && filters.regionSlug) {
    const region = await prisma.region.findUnique({ where: { slug: filters.regionSlug } });
    regionId = region?.id ?? null;
    if (!region) {
      return [];
    }
  }

  const blocks = await prisma.duoAvailability.findMany({
    where: {
      dayOfWeek: filters.dayOfWeek,
      duo: {
        isActive: true,
        ...(regionId ? { regionId } : {}),
      },
    },
    include: { duo: { include: { region: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return blocks.map((block) => ({
    duoName: block.duo.name,
    region: block.duo.region.name,
    dayOfWeek: block.dayOfWeek,
    startTime: block.startTime.toISOString().slice(11, 16),
    endTime: block.endTime.toISOString().slice(11, 16),
    recurring: block.recurring,
  }));
}

export async function logApiCall(
  apiClientId: string,
  endpoint: string,
  statusCode: number,
): Promise<void> {
  // Nooit payload-inhoud loggen die tot individuele spelers herleidbaar
  // is (US-H5) — alleen client/endpoint/statuscode.
  await prisma.auditLog.create({
    data: {
      entityType: "api_client",
      entityId: apiClientId,
      action: "availability_api_call",
      performedBy: null,
      payload: { endpoint, statusCode },
    },
  });
}
