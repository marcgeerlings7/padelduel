import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  match: { findMany: vi.fn() },
  ratingHistory: { findMany: vi.fn() },
  duo: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
};
const mockGetConfigNumberOrDefault = vi.fn(async (_key: string, fallback: number) => fallback);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/repositories/platformConfigRepository", () => ({
  getConfigNumberOrDefault: mockGetConfigNumberOrDefault,
}));

const { getDuoStats, getMatchHistory, getHeadToHead, StatsError } = await import(
  "@/server/services/statsService"
);

const NOW = new Date("2026-09-28T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function completed(id: string, challenger: string, challenged: string, scoreRaw: string, day: number) {
  return {
    id,
    challengeId: `c-${id}`,
    scoreRaw,
    submittedAt: daysAgo(day),
    confirmedAt: daysAgo(day),
    challenge: { challengerDuoId: challenger, challengedDuoId: challenged },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfigNumberOrDefault.mockImplementation(async (_key: string, fallback: number) => fallback);
});

describe("getDuoStats", () => {
  it("berekent stats voor alle duo's met precies één match-query en één aggregaat-query (geen N+1)", async () => {
    mockPrisma.match.findMany.mockResolvedValueOnce([
      completed("m1", "a", "b", "6-0,6-0", 10),
      completed("m2", "b", "c", "6-4,6-4", 5),
    ]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { duoId: "a", played: 1, forfeited: 1, lastChallengeSentAt: daysAgo(10), lastChallengeAcceptedAt: null },
      { duoId: "b", played: 2, forfeited: 0, lastChallengeSentAt: daysAgo(5), lastChallengeAcceptedAt: daysAgo(10) },
    ]);

    const stats = await getDuoStats(
      [
        { id: "a", createdAt: daysAgo(300) },
        { id: "b", createdAt: daysAgo(300) },
        { id: "c", createdAt: daysAgo(300) },
        { id: "d", createdAt: daysAgo(200) },
      ],
      NOW,
    );

    expect(mockPrisma.match.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(stats.get("a")).toMatchObject({
      wins: 1,
      losses: 0,
      streak: "W1",
      reliability: { played: 1, total: 2, percentage: 50 },
      inactive: false,
    });
    expect(stats.get("b")).toMatchObject({ wins: 1, losses: 1, streak: "W1", gameDifference: -12 + 4 });
    // c: laatste bevestigde match 5 dagen geleden -> actief, ook zonder eigen challenges.
    expect(stats.get("c")).toMatchObject({ wins: 0, losses: 1, inactive: false });
    // d: geen enkele activiteit sinds aanmaak 200 dagen geleden -> inactief.
    expect(stats.get("d")).toMatchObject({
      wins: 0,
      streak: "—",
      inactive: true,
      reliability: { played: 0, total: 0, percentage: null },
    });
    expect(mockGetConfigNumberOrDefault).toHaveBeenCalledWith("inactive_after_days", 60);
  });

  it("respecteert een inactive_after_days-override uit platform_config", async () => {
    mockGetConfigNumberOrDefault.mockResolvedValueOnce(300);
    mockPrisma.match.findMany.mockResolvedValueOnce([]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);

    const stats = await getDuoStats([{ id: "d", createdAt: daysAgo(200) }], NOW);
    expect(stats.get("d")!.inactive).toBe(false);
  });

  it("doet geen queries voor een lege lijst", async () => {
    expect((await getDuoStats([], NOW)).size).toBe(0);
    expect(mockPrisma.match.findMany).not.toHaveBeenCalled();
  });
});

describe("getMatchHistory", () => {
  it("geeft 404 voor een onbekend duo", async () => {
    mockPrisma.duo.findUnique.mockResolvedValueOnce(null);
    await expect(getMatchHistory("x", { page: 1, pageSize: 20 }, NOW)).rejects.toBeInstanceOf(StatsError);
  });

  it("pagineert de historie (nieuwste eerst) en levert een samenvatting", async () => {
    mockPrisma.duo.findUnique.mockResolvedValueOnce({ id: "a", name: "Alfa", createdAt: daysAgo(300), isActive: true });
    const ref = (id: string) => ({ id, name: id.toUpperCase() });
    const historyMatches = [1, 2, 3].map((day) => ({
      id: `m${day}`,
      challengeId: `c${day}`,
      status: "COMPLETED",
      scoreRaw: "6-3,6-3",
      submittedAt: daysAgo(day),
      confirmedAt: daysAgo(day),
      challenge: { challengerDuo: ref("a"), challengedDuo: ref("b") },
    }));
    // 1e findMany: historie-matches; 2e: bevestigde matches voor de samenvatting.
    mockPrisma.match.findMany
      .mockResolvedValueOnce(historyMatches)
      .mockResolvedValueOnce([1, 2, 3].map((d) => completed(`m${d}`, "a", "b", "6-3,6-3", d)));
    mockPrisma.ratingHistory.findMany.mockResolvedValueOnce([]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);

    const page = await getMatchHistory("a", { page: 2, pageSize: 2 }, NOW);

    expect(page.duo).toEqual({ id: "a", name: "Alfa", isActive: true });
    expect(page).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    expect(page.entries.map((e) => e.matchId)).toEqual(["m3"]);
    expect(page.summary).toMatchObject({ wins: 3, streak: "W3" });
  });
});

describe("getHeadToHead", () => {
  it("weigert hetzelfde duo aan beide kanten", async () => {
    await expect(getHeadToHead("a", "a")).rejects.toMatchObject({ code: "same_duo", httpStatus: 400 });
  });

  it("geeft 404 als een van beide duo's niet bestaat", async () => {
    mockPrisma.duo.findUnique
      .mockResolvedValueOnce({ id: "a", name: "A", createdAt: NOW, isActive: true })
      .mockResolvedValueOnce(null);
    await expect(getHeadToHead("a", "b")).rejects.toMatchObject({ code: "duo_not_found", httpStatus: 404 });
  });

  it("combineert matches en rating-delta's zonder extra query bij 0 ontmoetingen", async () => {
    mockPrisma.duo.findUnique
      .mockResolvedValueOnce({ id: "a", name: "A", createdAt: NOW, isActive: true })
      .mockResolvedValueOnce({ id: "b", name: "B", createdAt: NOW, isActive: true });
    mockPrisma.match.findMany.mockResolvedValueOnce([]);

    const h2h = await getHeadToHead("a", "b");

    expect(h2h).toMatchObject({ duo: { id: "a", name: "A" }, opponent: { id: "b", name: "B" }, matches: 0 });
    expect(mockPrisma.ratingHistory.findMany).not.toHaveBeenCalled();
  });
});
