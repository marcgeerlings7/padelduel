import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  apiClient: { findUnique: vi.fn() },
  region: { findUnique: vi.fn() },
  duoAvailability: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
};
const mockGetConfigNumber = vi.fn();
const mockCheckAndRecordRequest = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/repositories/platformConfigRepository", () => ({
  getConfigNumber: mockGetConfigNumber,
}));
vi.mock("@/lib/apiClient/rateLimit", () => ({
  checkAndRecordRequest: mockCheckAndRecordRequest,
}));

const {
  authenticateApiKey,
  enforceRateLimit,
  getPublicAvailability,
  logApiCall,
} = await import("@/server/services/externalAvailabilityService");
const { hashApiKey } = await import("@/lib/apiClient/apiKey");

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfigNumber.mockResolvedValue(60);
});

describe("authenticateApiKey", () => {
  it("accepteert een geldige, actieve key", async () => {
    mockPrisma.apiClient.findUnique.mockResolvedValueOnce({
      id: "client-1",
      apiKeyHash: hashApiKey("padel_live_geldig"),
      isActive: true,
      regionId: null,
    });
    const result = await authenticateApiKey("padel_live_geldig");
    expect(result).toEqual({ id: "client-1", regionId: null });
  });

  it("weigert een onbekende key", async () => {
    mockPrisma.apiClient.findUnique.mockResolvedValueOnce(null);
    await expect(authenticateApiKey("padel_live_onbekend")).rejects.toMatchObject({
      code: "invalid_api_key",
      httpStatus: 401,
    });
  });

  it("weigert een ingetrokken (niet-actieve) client", async () => {
    mockPrisma.apiClient.findUnique.mockResolvedValueOnce({
      id: "client-1",
      apiKeyHash: hashApiKey("padel_live_ingetrokken"),
      isActive: false,
      regionId: null,
    });
    await expect(authenticateApiKey("padel_live_ingetrokken")).rejects.toMatchObject({
      code: "invalid_api_key",
    });
  });
});

describe("enforceRateLimit", () => {
  it("laat door en logt niets als de limiet niet overschreden is", async () => {
    mockCheckAndRecordRequest.mockReturnValueOnce({ limited: false });
    await enforceRateLimit("client-1");
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("gooit een 429 en logt de overschrijding", async () => {
    mockCheckAndRecordRequest.mockReturnValueOnce({ limited: true, retryAfterSeconds: 30 });
    await expect(enforceRateLimit("client-1")).rejects.toMatchObject({
      code: "rate_limited",
      httpStatus: 429,
      retryAfterSeconds: 30,
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "availability_api_call" }) }),
    );
  });
});

describe("getPublicAvailability — privacy & scope", () => {
  it("de payload bevat NOOIT e-mailadressen of user-id's — alleen duo-naam, regio en tijdsblok", async () => {
    mockPrisma.duoAvailability.findMany.mockResolvedValueOnce([
      {
        dayOfWeek: 2,
        startTime: new Date("1970-01-01T19:00:00.000Z"),
        endTime: new Date("1970-01-01T21:00:00.000Z"),
        recurring: true,
        duo: { name: "Smash Sisters", region: { name: "Utrecht" } },
      },
    ]);

    const result = await getPublicAvailability({ id: "client-1", regionId: null }, {});

    expect(result).toEqual([
      { duoName: "Smash Sisters", region: "Utrecht", dayOfWeek: 2, startTime: "19:00", endTime: "21:00", recurring: true },
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/@/); // geen e-mailadres
    expect(serialized.toLowerCase()).not.toContain("userid");
    expect(serialized.toLowerCase()).not.toContain("email");
  });

  it("een regio-gescoped client krijgt altijd zijn eigen regio, ongeacht de gevraagde regio", async () => {
    mockPrisma.duoAvailability.findMany.mockResolvedValueOnce([]);

    await getPublicAvailability({ id: "client-1", regionId: "region-utrecht" }, { regionSlug: "amsterdam" });

    expect(mockPrisma.duoAvailability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          duo: expect.objectContaining({ regionId: "region-utrecht" }),
        }),
      }),
    );
    // regionSlug "amsterdam" wordt genegeerd — nooit prisma.region.findUnique
    // aangeroepen voor een reeds gescoped client.
    expect(mockPrisma.region.findUnique).not.toHaveBeenCalled();
  });
});

describe("logApiCall", () => {
  it("logt alleen endpoint en statuscode, geen persoonsherleidbare payload", async () => {
    await logApiCall("client-1", "/api/v1/availability", 200);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "api_client",
          entityId: "client-1",
          action: "availability_api_call",
          performedBy: null,
          payload: { endpoint: "/api/v1/availability", statusCode: 200 },
        }),
      }),
    );
  });
});
