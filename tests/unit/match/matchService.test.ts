import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  duoMembership: { findFirst: vi.fn() },
  challenge: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  match: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  duo: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  ratingHistory: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  $queryRaw: vi.fn(async () => [{ id: "locked" }]),
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

const mockGetLadder = vi.fn();
const mockGetConfigNumber = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
const mockGetConfigNumberOrDefault = vi.fn(async (_key: string, fallback: number) => fallback);

vi.mock("@/server/services/ladderService", () => ({ getLadderPositions: mockGetLadder }));
vi.mock("@/server/repositories/platformConfigRepository", () => ({
  getConfigNumber: mockGetConfigNumber,
  getConfigNumberOrDefault: mockGetConfigNumberOrDefault,
}));

const {
  submitScore,
  respondToMatch,
  autoConfirmOverdueMatches,
  expireUnplayedChallenges,
} = await import("@/server/services/matchService");

const CONFIG: Record<string, number> = {
  match_auto_confirm_hours: 48,
  repeated_opponent_window_days: 14,
  forfeit_rating_penalty: 10,
};

const VALID_SETS = [
  { challengerGames: 6, challengedGames: 4 },
  { challengerGames: 6, challengedGames: 3 },
];

function acceptedChallenge(overrides: Record<string, unknown> = {}) {
  return {
    id: "challenge-1",
    challengerDuoId: "duo-a",
    challengedDuoId: "duo-b",
    status: "ACCEPTED",
    matchDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

function duo(overrides: Record<string, unknown> = {}) {
  return {
    id: "duo-a",
    regionId: "region-1",
    currentRating: 1200,
    matchesPlayed: 20,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfigNumber.mockImplementation(async (key: string) => {
    if (key in CONFIG) return CONFIG[key];
    throw new Error(`onverwachte config-key in test: ${key}`);
  });
  mockGetConfigNumberOrDefault.mockImplementation(async (_key: string, fallback: number) => fallback);
  mockPrisma.duoMembership.findFirst.mockResolvedValue({ id: "membership-1" });
  mockPrisma.match.findUnique.mockResolvedValue(null); // standaard: geen bestaande match
  mockGetLadder.mockResolvedValue([
    { id: "duo-a", position: 3 },
    { id: "duo-b", position: 4 },
  ]);
  mockPrisma.match.findFirst.mockResolvedValue(null); // standaard: geen herhaalde tegenstander / geen actieve match
  mockPrisma.match.count.mockResolvedValue(0); // standaard: geen niet-voided match
  // Binnen de submitScore-transactie wordt de challenge na de rij-lock
  // opnieuw gelezen (findUniqueOrThrow); standaard dezelfde geaccepteerde challenge.
  mockPrisma.challenge.findUniqueOrThrow.mockResolvedValue(acceptedChallenge());
});

describe("submitScore", () => {
  it("maakt een match aan met auto_confirm_deadline en het geserialiseerde scoreformaat", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.match.create.mockResolvedValueOnce({ id: "match-1" });

    const result = await submitScore("challenge-1", "user-1", VALID_SETS, "key-1");

    expect(result).toEqual({ id: "match-1" });
    expect(mockPrisma.match.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          challengeId: "challenge-1",
          scoreRaw: "6-4,6-3",
          submittedBy: "user-1",
          idempotencyKey: "key-1",
          autoConfirmDeadline: expect.any(Date),
        }),
      }),
    );
  });

  it("weigert een ongeldige score (bijv. gelijkspel binnen een set)", async () => {
    // validateSets gooit vóór er enige DB-aanroep plaatsvindt — geen
    // challenge.findUnique-mock nodig (en queuen zou de mock-wachtrij
    // voor latere tests verstoren, aangezien hij nooit geconsumeerd wordt).
    await expect(
      submitScore(
        "challenge-1",
        "user-1",
        [
          { challengerGames: 6, challengedGames: 6 },
          { challengerGames: 6, challengedGames: 3 },
        ],
        "key-1",
      ),
    ).rejects.toMatchObject({ code: "invalid_score" });
  });

  it("weigert score-invoer als de challenge niet accepted is", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(acceptedChallenge({ status: "PENDING" }));
    await expect(submitScore("challenge-1", "user-1", VALID_SETS, "key-1")).rejects.toMatchObject({
      code: "challenge_not_accepted",
    });
  });

  it("weigert score-invoer na het verstrijken van match_deadline", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(
      acceptedChallenge({ matchDeadline: new Date(Date.now() - 60_000) }),
    );
    await expect(submitScore("challenge-1", "user-1", VALID_SETS, "key-1")).rejects.toMatchObject({
      code: "match_deadline_passed",
    });
  });

  it("weigert een gebruiker die geen lid is van een van beide duo's", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.duoMembership.findFirst.mockResolvedValue(null);
    await expect(submitScore("challenge-1", "user-1", VALID_SETS, "key-1")).rejects.toMatchObject({
      code: "not_a_member",
    });
  });

  it("is idempotent: dezelfde idempotency-key + challenge geeft de bestaande match terug, geen nieuwe insert", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.match.findUnique.mockResolvedValueOnce({ id: "match-existing", challengeId: "challenge-1" });

    const result = await submitScore("challenge-1", "user-1", VALID_SETS, "key-1");

    expect(result).toEqual({ id: "match-existing" });
    expect(mockPrisma.match.create).not.toHaveBeenCalled();
  });

  it("weigert hergebruik van dezelfde idempotency-key voor een andere challenge", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.match.findUnique.mockResolvedValueOnce({ id: "match-existing", challengeId: "ander-challenge" });

    await expect(submitScore("challenge-1", "user-1", VALID_SETS, "key-1")).rejects.toMatchObject({
      code: "idempotency_key_reused",
    });
  });

  it("weigert een tweede score-indiening voor dezelfde challenge (andere key)", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.match.findFirst.mockResolvedValueOnce({ id: "match-existing" }); // al een actieve (niet-voided) match

    await expect(submitScore("challenge-1", "user-1", VALID_SETS, "key-2")).rejects.toMatchObject({
      code: "score_already_submitted",
    });
    expect(mockPrisma.match.create).not.toHaveBeenCalled();
  });

  it("zoekt naar een bestaande match met uitsluiting van voided matches, onder een rij-lock op de challenge", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.match.create.mockResolvedValueOnce({ id: "match-2" });

    await submitScore("challenge-1", "user-1", VALID_SETS, "key-2");

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.match.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { challengeId: "challenge-1", status: { not: "VOIDED" } } }),
    );
  });

  it("replay: staat een nieuwe score toe als alle eerdere matches voided zijn (overturned dispute)", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(acceptedChallenge());
    // findFirst (niet-voided) -> null: de enige eerdere match is voided
    mockPrisma.match.findFirst.mockResolvedValueOnce(null);
    mockPrisma.match.create.mockResolvedValueOnce({ id: "match-replay" });

    const result = await submitScore("challenge-1", "user-1", VALID_SETS, "key-replay");

    expect(result).toEqual({ id: "match-replay" });
    expect(mockPrisma.match.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ challengeId: "challenge-1", idempotencyKey: "key-replay" }),
      }),
    );
  });

  it("hercontroleert de status ná de rij-lock (challenge net op unplayed_timeout gezet door de job)", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(acceptedChallenge({ status: "UNPLAYED_TIMEOUT" }));

    await expect(submitScore("challenge-1", "user-1", VALID_SETS, "key-3")).rejects.toMatchObject({
      code: "challenge_not_accepted",
    });
    expect(mockPrisma.match.create).not.toHaveBeenCalled();
  });

  it("vertaalt een unieke-index-conflict (gelijktijdige submit) naar score_already_submitted", async () => {
    const { Prisma } = await import("@prisma/client");
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.match.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    mockPrisma.match.findUnique
      .mockResolvedValueOnce(null) // idempotency-pre-check
      .mockResolvedValueOnce(null); // na het conflict: geen match met deze key

    await expect(submitScore("challenge-1", "user-1", VALID_SETS, "key-4")).rejects.toMatchObject({
      code: "score_already_submitted",
    });
  });

  it("geeft bij een unieke-index-conflict op dezelfde idempotency-key de bestaande match terug", async () => {
    const { Prisma } = await import("@prisma/client");
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.match.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    mockPrisma.match.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "match-race", challengeId: "challenge-1" });

    await expect(submitScore("challenge-1", "user-1", VALID_SETS, "key-5")).resolves.toEqual({
      id: "match-race",
    });
  });
});

describe("respondToMatch — dispute", () => {
  it("betwisten zet status op disputed, zonder ELO-verwerking", async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: "match-1",
      status: "AWAITING_CONFIRMATION",
      challengeId: "challenge-1",
      submittedBy: "user-1",
    });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(acceptedChallenge());
    // submitter (user-1) is lid van duo-a; acting user (user-2) van duo-b
    mockPrisma.duoMembership.findFirst
      .mockResolvedValueOnce({ id: "m1" }) // submitterIsChallenger check (duo-a, user-1) -> true
      .mockResolvedValueOnce({ id: "m2" }); // actingIsOtherDuoMember (duo-b, user-2) -> true

    const result = await respondToMatch("match-1", "user-2", "dispute");

    expect(result).toEqual({ status: "disputed" });
    expect(mockPrisma.match.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "DISPUTED" } }),
    );
    expect(mockPrisma.duo.update).not.toHaveBeenCalled();
  });
});

describe("respondToMatch — confirm (ELO-verwerking)", () => {
  function setupConfirmScenario(scoreRaw = "6-4,6-3") {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: "match-1",
      status: "AWAITING_CONFIRMATION",
      challengeId: "challenge-1",
      submittedBy: "user-1",
    });
    // findUniqueOrThrow wordt tweemaal aangeroepen: eenmaal door
    // respondToMatch zelf (autorisatie) en eenmaal opnieuw binnen
    // finalizeMatch (percentiel-/winnaarsbepaling) — vandaar 2x gequeued.
    mockPrisma.challenge.findUniqueOrThrow
      .mockResolvedValueOnce(acceptedChallenge())
      .mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.duoMembership.findFirst
      .mockResolvedValueOnce({ id: "m1" }) // submitter is lid van challenger-duo
      .mockResolvedValueOnce({ id: "m2" }); // acting user is lid van de ANDERE duo

    mockPrisma.match.findUniqueOrThrow.mockResolvedValueOnce({
      id: "match-1",
      status: "AWAITING_CONFIRMATION",
      challengeId: "challenge-1",
      scoreRaw, // standaard "6-4,6-3": challenger wint -> duo-a is winnaar
    });
    mockPrisma.duo.findUniqueOrThrow
      .mockResolvedValueOnce(duo({ id: "duo-a", currentRating: 1200 })) // winner
      .mockResolvedValueOnce(duo({ id: "duo-b", currentRating: 1200 })); // loser
    mockPrisma.match.updateMany.mockResolvedValueOnce({ count: 1 });
  }

  it("bevestigen werkt de rating van beide duo's transactioneel bij en maakt 2 RatingHistory-records aan", async () => {
    setupConfirmScenario();

    const result = await respondToMatch("match-1", "user-2", "confirm");

    expect(result).toEqual({ status: "completed" });
    expect(mockPrisma.duo.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.ratingHistory.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.ratingHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ duoId: "duo-a", isForfeit: false }) }),
    );
    expect(mockPrisma.ratingHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ duoId: "duo-b", isForfeit: false }) }),
    );
    expect(mockPrisma.challenge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "COMPLETED" } }),
    );
  });

  function ratingUpdates(): Record<string, number> {
    return Object.fromEntries(
      mockPrisma.duo.update.mock.calls.map(([arg]) => [
        (arg as { where: { id: string } }).where.id,
        (arg as { data: { currentRating: number } }).data.currentRating,
      ]),
    );
  }

  // ELO_Algoritme.md §2bis: K=24 (established), gelijke ratings (E=0.5),
  // M = 0.75 + 0.75 * m met m = (G_w - G_l) / (G_w + G_l).
  it.each([
    ["6-4,6-3", 1211, 1189], // games 12-7, m=5/19, M≈0.947 -> 11.37
    ["6-0,6-0", 1218, 1182], // m=1, M=1.5 -> 18
    ["7-6,6-7,10-8", 1209, 1191], // games 14-13 (tiebreak = 1-0), M≈0.778 -> 9.33
  ])(
    "verwerkt het gamesaldo van %s in de ELO-update (winnaar %i, verliezer %i)",
    async (scoreRaw, winnerRating, loserRating) => {
      setupConfirmScenario(scoreRaw);

      await respondToMatch("match-1", "user-2", "confirm");

      expect(ratingUpdates()).toEqual({ "duo-a": winnerRating, "duo-b": loserRating });
    },
  );

  it("slaat de effectief toegepaste K (incl. gamesaldo-multiplier) op in RatingHistory", async () => {
    setupConfirmScenario("6-0,6-0");

    await respondToMatch("match-1", "user-2", "confirm");

    expect(mockPrisma.ratingHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ duoId: "duo-a", kFactor: 36 }) }),
    );
  });

  it("leest de multipliers uit platform_config (met fallback) en past een override toe", async () => {
    mockGetConfigNumberOrDefault.mockImplementation(async (key: string, fallback: number) =>
      key === "elo_margin_multiplier_min" || key === "elo_margin_multiplier_max" ? 1 : fallback,
    );
    setupConfirmScenario("6-0,6-0");

    await respondToMatch("match-1", "user-2", "confirm");

    // M = 1 -> klassieke ELO: 24 * 0.5 = 12.
    expect(ratingUpdates()).toEqual({ "duo-a": 1212, "duo-b": 1188 });
    expect(mockGetConfigNumberOrDefault).toHaveBeenCalledWith("elo_margin_multiplier_min", 0.75);
    expect(mockGetConfigNumberOrDefault).toHaveBeenCalledWith("elo_margin_multiplier_max", 1.5);
  });

  it("weigert te verwerken bij een ongeldige multiplier-config (min <= 0), zonder rating-wijziging", async () => {
    mockGetConfigNumberOrDefault.mockImplementation(async (key: string, fallback: number) =>
      key === "elo_margin_multiplier_min" ? 0 : fallback,
    );
    setupConfirmScenario();

    await expect(respondToMatch("match-1", "user-2", "confirm")).rejects.toThrow(/elo_margin_multiplier_min/);
    expect(mockPrisma.duo.update).not.toHaveBeenCalled();
    expect(mockPrisma.match.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }),
    );
  });

  it("weigert dat de indiener zijn eigen score bevestigt", async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: "match-1",
      status: "AWAITING_CONFIRMATION",
      challengeId: "challenge-1",
      submittedBy: "user-1",
    });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.duoMembership.findFirst
      .mockResolvedValueOnce({ id: "m1" }) // submitter is lid van challenger-duo
      .mockResolvedValueOnce(null) // acting user is GEEN lid van de andere duo
      .mockResolvedValueOnce({ id: "m3" }); // acting user is lid van DEZELFDE (submitter-)duo

    await expect(respondToMatch("match-1", "user-1", "confirm")).rejects.toMatchObject({
      code: "cannot_respond_to_own_score",
    });
    expect(mockPrisma.duo.update).not.toHaveBeenCalled();
  });

  it("weigert een match die niet meer awaiting_confirmation is", async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: "match-1",
      status: "COMPLETED",
      challengeId: "challenge-1",
      submittedBy: "user-1",
    });
    await expect(respondToMatch("match-1", "user-2", "confirm")).rejects.toMatchObject({
      code: "match_not_awaiting_confirmation",
    });
  });
});

describe("autoConfirmOverdueMatches", () => {
  it("bevestigt verlopen matches automatisch en labelt dit in de audit log", async () => {
    mockPrisma.match.findMany.mockResolvedValueOnce([{ id: "match-1" }]);
    mockPrisma.match.findUniqueOrThrow.mockResolvedValueOnce({
      id: "match-1",
      status: "AWAITING_CONFIRMATION",
      challengeId: "challenge-1",
      scoreRaw: "6-4,6-3",
    });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.duo.findUniqueOrThrow
      .mockResolvedValueOnce(duo({ id: "duo-a", currentRating: 1200 }))
      .mockResolvedValueOnce(duo({ id: "duo-b", currentRating: 1200 }));
    mockPrisma.match.updateMany.mockResolvedValueOnce({ count: 1 });

    const results = await autoConfirmOverdueMatches();

    expect(results).toEqual([{ matchId: "match-1", alreadyProcessed: false }]);
    expect(mockPrisma.match.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ confirmedBy: null }) }),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "match_auto_confirmed", entityId: "match-1" }),
      }),
    );
  });

  it("is idempotent: een match die niet meer awaiting_confirmation is, wordt overgeslagen", async () => {
    mockPrisma.match.findMany.mockResolvedValueOnce([{ id: "match-1" }]);
    mockPrisma.match.findUniqueOrThrow.mockResolvedValueOnce({
      id: "match-1",
      status: "COMPLETED", // al verwerkt
    });

    const results = await autoConfirmOverdueMatches();

    expect(results).toEqual([{ matchId: "match-1", alreadyProcessed: true }]);
    expect(mockPrisma.duo.update).not.toHaveBeenCalled();
    expect(mockPrisma.ratingHistory.create).not.toHaveBeenCalled();
  });
});

describe("expireUnplayedChallenges", () => {
  it("selecteert alleen challenges zonder niet-voided match (replay na overturned dispute telt mee)", async () => {
    mockPrisma.challenge.findMany.mockResolvedValueOnce([]);

    await expireUnplayedChallenges();

    expect(mockPrisma.challenge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACCEPTED",
          matches: { none: { status: { not: "VOIDED" } } },
        }),
      }),
    );
  });

  it("slaat een challenge over als er ná de rij-lock toch een niet-voided match blijkt te zijn", async () => {
    mockPrisma.challenge.findMany.mockResolvedValueOnce([{ id: "challenge-1" }]);
    mockPrisma.match.count.mockResolvedValueOnce(1); // net een (replay-)score ingediend

    const results = await expireUnplayedChallenges();

    expect(results).toEqual([null]);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.challenge.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.duo.update).not.toHaveBeenCalled();
  });

  it("controleert in de compare-and-swap opnieuw de (mogelijk verlengde) deadline", async () => {
    mockPrisma.challenge.findMany.mockResolvedValueOnce([{ id: "challenge-1" }]);
    mockPrisma.challenge.updateMany.mockResolvedValueOnce({ count: 0 }); // deadline intussen verlengd

    const results = await expireUnplayedChallenges();

    expect(results).toEqual([null]);
    expect(mockPrisma.challenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "challenge-1", status: "ACCEPTED", matchDeadline: { lt: expect.any(Date) } },
      }),
    );
    expect(mockPrisma.ratingHistory.create).not.toHaveBeenCalled();
  });

  it("past de forfeit-penalty toe op BEIDE duo's", async () => {
    mockPrisma.challenge.findMany.mockResolvedValueOnce([{ id: "challenge-1" }]);
    mockPrisma.challenge.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(acceptedChallenge());
    mockPrisma.duo.findUniqueOrThrow
      .mockResolvedValueOnce(duo({ id: "duo-a", currentRating: 1300 }))
      .mockResolvedValueOnce(duo({ id: "duo-b", currentRating: 1150 }));

    const results = await expireUnplayedChallenges();

    expect(results).toEqual([
      { challengeId: "challenge-1", challengerDuoId: "duo-a", challengedDuoId: "duo-b" },
    ]);
    expect(mockPrisma.duo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "duo-a" }, data: { currentRating: 1290 } }),
    );
    expect(mockPrisma.duo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "duo-b" }, data: { currentRating: 1140 } }),
    );
    expect(mockPrisma.ratingHistory.create).toHaveBeenCalledTimes(2);
  });

  it("is idempotent: een tweede run over dezelfde (al verwerkte) challenge doet niets", async () => {
    mockPrisma.challenge.findMany.mockResolvedValueOnce([{ id: "challenge-1" }]);
    mockPrisma.challenge.updateMany.mockResolvedValueOnce({ count: 0 }); // al UNPLAYED_TIMEOUT

    const results = await expireUnplayedChallenges();

    expect(results).toEqual([null]);
    expect(mockPrisma.duo.update).not.toHaveBeenCalled();
    expect(mockPrisma.ratingHistory.create).not.toHaveBeenCalled();
  });
});
