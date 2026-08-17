import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/apiClient/apiKey";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

export async function createApiClient(
  name: string,
  regionId?: string,
): Promise<{ id: string; plaintextKey: string }> {
  if (regionId) {
    const region = await prisma.region.findUnique({ where: { id: regionId } });
    if (!region) {
      throw new ApiClientError("Regio niet gevonden.", "region_not_found", 404);
    }
  }

  const { plaintextKey, keyHash } = generateApiKey();
  const client = await prisma.apiClient.create({
    data: { name, regionId: regionId ?? null, apiKeyHash: keyHash },
  });

  // De plaintext-key wordt NERGENS opgeslagen — dit is de enige keer dat
  // hij beschikbaar is (US-H3).
  return { id: client.id, plaintextKey };
}

export async function listApiClients() {
  return prisma.apiClient.findMany({
    include: { region: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeApiClient(clientId: string): Promise<void> {
  const client = await prisma.apiClient.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new ApiClientError("API-client niet gevonden.", "client_not_found", 404);
  }
  if (!client.isActive) {
    throw new ApiClientError("Deze API-client is al ingetrokken.", "already_revoked", 400);
  }
  await prisma.apiClient.update({
    where: { id: clientId },
    data: { isActive: false, revokedAt: new Date() },
  });
}
