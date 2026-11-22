import { describe, it, expect, vi, beforeEach } from "vitest";

/** Laag D (akkoord PO 2026-11-22): startratings van ongespeelde duo's herberekenen. */
const mockPrisma = {
  user: { findUnique: vi.fn() },
  duo: { findMany: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  $queryRaw: vi.fn(async () => []),
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/repositories/platformConfigRepository", () => ({
  getConfigNumber: async (key: string) => {
    if (key === "default_start_rating") return 1200;
    throw new Error(key);
  },
  getConfigNumberOrDefault: async (_key: string, defaultValue: number) => defaultValue,
}));

const { recalculateStartRatings, getPlacementConfig } = await import("@/server/services/startRatingService");

type Candidate = { id: string; name: string; currentRating: number; memberships: { userId: string }[] };
const candidate = (id: string, rating: number, members: [string, string]): Candidate => ({
  id,
  name: `Duo ${id}`,
  currentRating: rating,
  memberships: members.map((userId) => ({ userId })),
});

const LEVELS: Record<string, { knltbLevel: number | null; knltbLevelVerifiedAt: Date | null }> = {
  top: { knltbLevel: 1, knltbLevelVerifiedAt: new Date() }, // 1600
  mid: { knltbLevel: 5, knltbLevelVerifiedAt: null }, // 1400
  none: { knltbLevel: null, knltbLevelVerifiedAt: null }, // 1200
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => LEVELS[where.id]);
});

function mockDuos(candidates: Candidate[], playedByUser: Record<string, number[]> = {}) {
  mockPrisma.duo.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    // Eerste aanroep: kandidaten (matchesPlayed: 0). Daarna: gespeelde duo's per speler.
    if (args.where.matchesPlayed === 0) return candidates;
    const userId = (args.where.memberships as { some: { userId: string } }).some.userId;
    return (playedByUser[userId] ?? []).map((currentRating) => ({ currentRating }));
  });
}

describe("recalculateStartRatings", () => {
  it("selecteert alleen actieve duo's zonder wedstrijden, historie of challenges in de regio", async () => {
    mockDuos([]);
    await recalculateStartRatings({ regionId: "r1" }, "admin-1");
    expect(mockPrisma.duo.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      matchesPlayed: 0,
      ratingHistory: { none: {} },
      challengesAsChallenger: { none: {} },
      challengesAsChallenged: { none: {} },
      regionId: "r1",
    });
  });

  it("past ratings aan naar de speelsterkte en logt één audit-rij", async () => {
    mockDuos([candidate("d1", 1200, ["top", "mid"]), candidate("d2", 1200, ["none", "none"])]);
    const result = await recalculateStartRatings({ regionId: "r1" }, "admin-1");

    expect(result).toEqual({
      checked: 2,
      changed: [{ duoId: "d1", duoName: "Duo d1", from: 1200, to: 1500 }],
    });
    expect(mockPrisma.duo.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.duo.update).toHaveBeenCalledWith({ where: { id: "d1" }, data: { currentRating: 1500 } });
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1); // row lock
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "region",
        entityId: "r1",
        action: "start_ratings_recalculated",
        performedBy: "admin-1",
        payload: { changes: [{ duoId: "d1", from: 1200, to: 1500 }] },
      }),
    });
  });

  it("gespeelde andere duo's van een speler gaan voor de speelsterkte", async () => {
    mockDuos([candidate("d1", 1200, ["top", "none"])], { top: [1300] });
    const result = await recalculateStartRatings({ userId: "top" }, "admin-1");
    expect(result.changed).toEqual([{ duoId: "d1", duoName: "Duo d1", from: 1200, to: 1250 }]);
    expect(mockPrisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ entityType: "app_user", entityId: "top" });
  });

  it("geen wijzigingen → geen updates en geen audit-rij", async () => {
    mockDuos([candidate("d1", 1200, ["none", "none"])]);
    const result = await recalculateStartRatings({ regionId: "r1" }, "admin-1");
    expect(result).toEqual({ checked: 1, changed: [] });
    expect(mockPrisma.duo.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("getPlacementConfig", () => {
  it("valt terug op de defaults zolang de config-rijen ontbreken", async () => {
    await expect(getPlacementConfig()).resolves.toEqual({ maxMatches: 10, tiersUp: 2 });
  });
});
