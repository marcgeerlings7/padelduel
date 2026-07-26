import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  duoMembership: { findFirst: vi.fn() },
  duo: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  challenge: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  ratingHistory: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

const mockGetConfigNumber = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/repositories/platformConfigRepository", () => ({
  getConfigNumber: mockGetConfigNumber,
}));

const {
  proposeChallenge,
  respondToChallenge,
  expireOverdueChallenges,
} = await import("@/server/services/challengeService");

const CONFIG = {
  rating_tier_size: 100,
  challenge_response_deadline_days: 5,
  challenge_match_deadline_days: 14,
  forfeit_rating_penalty: 10,
  forfeit_cooldown_days: 3,
};

function duo(overrides: Partial<{ id: string; regionId: string; currentRating: number; isActive: boolean }> = {}) {
  return {
    id: "duo-1",
    regionId: "region-1",
    currentRating: 1200,
    isActive: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfigNumber.mockImplementation(async (key: string) => {
    if (key in CONFIG) return CONFIG[key as keyof typeof CONFIG];
    throw new Error(`onverwachte config-key in test: ${key}`);
  });
  mockPrisma.duoMembership.findFirst.mockResolvedValue({ id: "membership-1" });
  mockPrisma.challenge.findFirst.mockResolvedValue(null); // standaard: geen actieve challenge
  mockPrisma.ratingHistory.findFirst.mockResolvedValue(null); // standaard: geen cooldown
});

describe("proposeChallenge", () => {
  it("maakt een pending challenge aan tussen twee duo's in dezelfde regio/tier", async () => {
    mockPrisma.duo.findUnique
      .mockResolvedValueOnce(duo({ id: "duo-a", currentRating: 1220 }))
      .mockResolvedValueOnce(duo({ id: "duo-b", currentRating: 1250 }));
    mockPrisma.challenge.create.mockResolvedValueOnce({ id: "challenge-1" });

    const result = await proposeChallenge("duo-a", "duo-b", "user-1");

    expect(result).toEqual({ id: "challenge-1" });
    expect(mockPrisma.challenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ challengerDuoId: "duo-a", challengedDuoId: "duo-b" }),
      }),
    );
  });

  it("weigert een duo dat zichzelf uitdaagt", async () => {
    await expect(proposeChallenge("duo-a", "duo-a", "user-1")).rejects.toMatchObject({
      code: "cannot_challenge_self",
    });
  });

  it("weigert een gebruiker die geen lid is van het uitdagende duo", async () => {
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce(null);
    await expect(proposeChallenge("duo-a", "duo-b", "user-1")).rejects.toMatchObject({
      code: "not_a_member",
    });
  });

  it("weigert uitdagen buiten de eigen regio", async () => {
    mockPrisma.duo.findUnique
      .mockResolvedValueOnce(duo({ id: "duo-a", regionId: "region-1" }))
      .mockResolvedValueOnce(duo({ id: "duo-b", regionId: "region-2" }));

    await expect(proposeChallenge("duo-a", "duo-b", "user-1")).rejects.toMatchObject({
      code: "different_region",
    });
  });

  it("weigert uitdagen buiten de eigen rating-tier, ook als de UI dat zou toestaan", async () => {
    mockPrisma.duo.findUnique
      .mockResolvedValueOnce(duo({ id: "duo-a", currentRating: 1150 })) // tier 11
      .mockResolvedValueOnce(duo({ id: "duo-b", currentRating: 1450 })); // tier 14

    await expect(proposeChallenge("duo-a", "duo-b", "user-1")).rejects.toMatchObject({
      code: "different_tier",
    });
  });

  it("weigert als het uitdagende duo al een actieve challenge heeft", async () => {
    mockPrisma.duo.findUnique
      .mockResolvedValueOnce(duo({ id: "duo-a" }))
      .mockResolvedValueOnce(duo({ id: "duo-b" }));
    mockPrisma.challenge.findFirst.mockResolvedValueOnce({ id: "existing" });

    await expect(proposeChallenge("duo-a", "duo-b", "user-1")).rejects.toMatchObject({
      code: "challenger_has_active_challenge",
    });
  });

  it("weigert als het uitgedaagde duo al een actieve challenge heeft", async () => {
    mockPrisma.duo.findUnique
      .mockResolvedValueOnce(duo({ id: "duo-a" }))
      .mockResolvedValueOnce(duo({ id: "duo-b" }));
    mockPrisma.challenge.findFirst
      .mockResolvedValueOnce(null) // challenger: geen actieve challenge
      .mockResolvedValueOnce({ id: "existing" }); // challenged: wel

    await expect(proposeChallenge("duo-a", "duo-b", "user-1")).rejects.toMatchObject({
      code: "challenged_has_active_challenge",
    });
  });

  it("weigert als het uitdagende duo in de forfeit-cooldown zit", async () => {
    mockPrisma.duo.findUnique
      .mockResolvedValueOnce(duo({ id: "duo-a" }))
      .mockResolvedValueOnce(duo({ id: "duo-b" }));
    mockPrisma.ratingHistory.findFirst.mockResolvedValueOnce({ createdAt: new Date() });

    await expect(proposeChallenge("duo-a", "duo-b", "user-1")).rejects.toMatchObject({
      code: "challenger_in_cooldown",
    });
  });
});

describe("respondToChallenge", () => {
  const pendingChallenge = {
    id: "challenge-1",
    challengerDuoId: "duo-a",
    challengedDuoId: "duo-b",
    status: "PENDING",
    responseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // morgen
  };

  it("accepteren zet status op ACCEPTED met een match_deadline", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(pendingChallenge);

    await respondToChallenge("challenge-1", "user-1", "accept");

    expect(mockPrisma.challenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACCEPTED", matchDeadline: expect.any(Date) }),
      }),
    );
  });

  it("weigeren zet status op DECLINED", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(pendingChallenge);

    await respondToChallenge("challenge-1", "user-1", "decline");

    expect(mockPrisma.challenge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DECLINED" }) }),
    );
  });

  it("weigert een reactie van iemand die geen lid is van het uitgedaagde duo", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(pendingChallenge);
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce(null);

    await expect(respondToChallenge("challenge-1", "user-1", "accept")).rejects.toMatchObject({
      code: "not_a_member",
    });
  });

  it("weigert een reactie op een reeds verlopen challenge, met een duidelijke melding", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce({
      ...pendingChallenge,
      responseDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000), // gisteren
    });

    await expect(respondToChallenge("challenge-1", "user-1", "accept")).rejects.toMatchObject({
      code: "response_deadline_passed",
    });
  });

  it("weigert een reactie op een challenge die niet meer pending is", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce({
      ...pendingChallenge,
      status: "DECLINED",
    });

    await expect(respondToChallenge("challenge-1", "user-1", "accept")).rejects.toMatchObject({
      code: "challenge_not_pending",
    });
  });
});

describe("expireOverdueChallenges", () => {
  it("past de forfeit-penalty alleen toe op het uitgedaagde duo", async () => {
    mockPrisma.challenge.findMany.mockResolvedValueOnce([{ id: "challenge-1" }]);
    mockPrisma.challenge.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce({
      id: "challenge-1",
      challengerDuoId: "duo-a",
      challengedDuoId: "duo-b",
    });
    mockPrisma.duo.findUniqueOrThrow.mockResolvedValueOnce(duo({ id: "duo-b", currentRating: 1200 }));

    const results = await expireOverdueChallenges();

    expect(results).toEqual([{ challengeId: "challenge-1", challengedDuoId: "duo-b" }]);
    expect(mockPrisma.duo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "duo-b" }, data: { currentRating: 1190 } }),
    );
    expect(mockPrisma.ratingHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ duoId: "duo-b", challengeId: "challenge-1", isForfeit: true }),
      }),
    );
  });

  it("is idempotent: een tweede run over dezelfde challenge past de penalty niet dubbel toe", async () => {
    // Eerste run: challenge bestaat nog als PENDING, updateMany slaagt (count 1).
    mockPrisma.challenge.findMany.mockResolvedValueOnce([{ id: "challenge-1" }]);
    mockPrisma.challenge.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce({
      id: "challenge-1",
      challengerDuoId: "duo-a",
      challengedDuoId: "duo-b",
    });
    mockPrisma.duo.findUniqueOrThrow.mockResolvedValueOnce(duo({ id: "duo-b", currentRating: 1200 }));
    await expireOverdueChallenges();
    expect(mockPrisma.ratingHistory.create).toHaveBeenCalledTimes(1);

    // Tweede run: challenge is al EXPIRED, dus de guard (updateMany met
    // WHERE status='PENDING') matcht niets meer (count 0) -> geen penalty.
    mockPrisma.challenge.findMany.mockResolvedValueOnce([{ id: "challenge-1" }]);
    mockPrisma.challenge.updateMany.mockResolvedValueOnce({ count: 0 });

    const secondRunResults = await expireOverdueChallenges();

    expect(secondRunResults).toEqual([null]);
    expect(mockPrisma.ratingHistory.create).toHaveBeenCalledTimes(1); // nog steeds maar 1x
    expect(mockPrisma.duo.update).toHaveBeenCalledTimes(1);
  });
});
