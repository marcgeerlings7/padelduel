import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  duoMembership: { findMany: vi.fn() },
};
const mockGetLadder = vi.fn();
const mockGetConfigNumber = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/services/ladderService", () => ({ getLadder: mockGetLadder }));
vi.mock("@/server/repositories/platformConfigRepository", () => ({
  getConfigNumber: mockGetConfigNumber,
}));

const { getDashboard } = await import("@/server/services/dashboardService");

function ladderOf(size: number, regionId = "region-1") {
  return Array.from({ length: size }, (_, i) => ({
    id: `duo-${i + 1}`,
    name: `Duo ${i + 1}`,
    regionId,
    currentRating: 2000 - i * 10,
    createdAt: new Date(2026, 0, i + 1),
    position: i + 1,
  }));
}

function membership(duoId: string, regionId = "region-1") {
  return {
    duo: {
      id: duoId,
      name: `Duo ${duoId}`,
      regionId,
      currentRating: 1200,
      region: { id: regionId, name: "Utrecht", slug: "utrecht" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfigNumber.mockResolvedValue(5);
});

describe("getDashboard", () => {
  it("geeft een lege lijst en canFormMoreDuos=true als de gebruiker geen enkel actief duo heeft", async () => {
    mockPrisma.duoMembership.findMany.mockResolvedValueOnce([]);

    const result = await getDashboard("user-1");

    expect(result.duos).toEqual([]);
    expect(result.activeDuoCount).toBe(0);
    expect(result.canFormMoreDuos).toBe(true);
  });

  it("berekent 3 boven en 3 onder voor een duo in het midden van de ladder", async () => {
    mockPrisma.duoMembership.findMany.mockResolvedValueOnce([membership("duo-5")]);
    mockGetLadder.mockResolvedValueOnce(ladderOf(10));

    const result = await getDashboard("user-1");

    expect(result.duos).toHaveLength(1);
    const card = result.duos[0];
    expect(card.duo.position).toBe(5);
    expect(card.above.map((d) => d.id)).toEqual(["duo-2", "duo-3", "duo-4"]);
    expect(card.below.map((d) => d.id)).toEqual(["duo-6", "duo-7", "duo-8"]);
  });

  it("geeft minder dan 3 boven als het duo bovenaan de ladder staat", async () => {
    mockPrisma.duoMembership.findMany.mockResolvedValueOnce([membership("duo-1")]);
    mockGetLadder.mockResolvedValueOnce(ladderOf(10));

    const result = await getDashboard("user-1");

    expect(result.duos[0].duo.position).toBe(1);
    expect(result.duos[0].above).toEqual([]);
    expect(result.duos[0].below.map((d) => d.id)).toEqual(["duo-2", "duo-3", "duo-4"]);
  });

  it("geeft minder dan 3 onder als het duo onderaan de ladder staat", async () => {
    mockPrisma.duoMembership.findMany.mockResolvedValueOnce([membership("duo-10")]);
    mockGetLadder.mockResolvedValueOnce(ladderOf(10));

    const result = await getDashboard("user-1");

    expect(result.duos[0].duo.position).toBe(10);
    expect(result.duos[0].below).toEqual([]);
    expect(result.duos[0].above.map((d) => d.id)).toEqual(["duo-7", "duo-8", "duo-9"]);
  });

  it("hergebruikt de ladder-query als de gebruiker meerdere duo's in dezelfde regio heeft", async () => {
    mockPrisma.duoMembership.findMany.mockResolvedValueOnce([
      membership("duo-1"),
      membership("duo-2"),
    ]);
    mockGetLadder.mockResolvedValueOnce(ladderOf(10));

    const result = await getDashboard("user-1");

    expect(mockGetLadder).toHaveBeenCalledTimes(1);
    expect(result.duos).toHaveLength(2);
  });

  it("canFormMoreDuos is false zodra het maximum bereikt is", async () => {
    mockGetConfigNumber.mockResolvedValue(2);
    mockPrisma.duoMembership.findMany.mockResolvedValueOnce([
      membership("duo-1"),
      membership("duo-2"),
    ]);
    mockGetLadder.mockResolvedValueOnce(ladderOf(10));

    const result = await getDashboard("user-1");

    expect(result.activeDuoCount).toBe(2);
    expect(result.maxActiveDuos).toBe(2);
    expect(result.canFormMoreDuos).toBe(false);
  });
});
