import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  region: { findUnique: vi.fn() },
  apiClient: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { createApiClient, listApiClients, revokeApiClient } = await import(
  "@/server/services/apiClientService"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createApiClient", () => {
  it("slaat alleen de hash op, nooit de plaintext-key, en geeft de plaintext eenmalig terug", async () => {
    mockPrisma.apiClient.create.mockResolvedValueOnce({ id: "client-1" });

    const result = await createApiClient("Club Utrecht");

    expect(result.plaintextKey).toMatch(/^padel_live_/);
    const createArgs = mockPrisma.apiClient.create.mock.calls[0][0];
    expect(createArgs.data.apiKeyHash).not.toBe(result.plaintextKey);
    expect(createArgs.data).not.toHaveProperty("plaintextKey");
    expect(createArgs.data).not.toHaveProperty("apiKey");
  });

  it("weigert een onbekende regio", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce(null);
    await expect(createApiClient("Club X", "region-onbekend")).rejects.toMatchObject({
      code: "region_not_found",
    });
  });
});

describe("revokeApiClient", () => {
  it("zet is_active op false en revoked_at", async () => {
    mockPrisma.apiClient.findUnique.mockResolvedValueOnce({ id: "client-1", isActive: true });
    await revokeApiClient("client-1");
    expect(mockPrisma.apiClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false, revokedAt: expect.any(Date) }),
      }),
    );
  });

  it("weigert een al ingetrokken client", async () => {
    mockPrisma.apiClient.findUnique.mockResolvedValueOnce({ id: "client-1", isActive: false });
    await expect(revokeApiClient("client-1")).rejects.toMatchObject({ code: "already_revoked" });
  });

  it("weigert een onbekende client", async () => {
    mockPrisma.apiClient.findUnique.mockResolvedValueOnce(null);
    await expect(revokeApiClient("client-x")).rejects.toMatchObject({ code: "client_not_found" });
  });
});

describe("listApiClients", () => {
  it("geeft de lijst terug (nooit de plaintext-key, die bestaat serverside niet)", async () => {
    mockPrisma.apiClient.findMany.mockResolvedValueOnce([{ id: "client-1", name: "Club Utrecht" }]);
    const result = await listApiClients();
    expect(result).toEqual([{ id: "client-1", name: "Club Utrecht" }]);
  });
});
