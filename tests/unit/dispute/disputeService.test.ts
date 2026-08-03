import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  match: { findUnique: vi.fn(), updateMany: vi.fn() },
  challenge: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  duoMembership: { findFirst: vi.fn() },
  dispute: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  duo: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  ratingHistory: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

const mockGetConfigNumber = vi.fn();
const mockFinalizeMatch = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/repositories/platformConfigRepository", () => ({
  getConfigNumber: mockGetConfigNumber,
}));
vi.mock("@/server/services/matchService", () => ({ finalizeMatch: mockFinalizeMatch }));

const {
  openMatchScoreDispute,
  openForfeitDispute,
  resolveMatchScoreDispute,
  resolveForfeitDispute,
} = await import("@/server/services/disputeService");

const CONFIG: Record<string, number> = {
  forfeit_dispute_window_days: 5,
  forfeit_rating_penalty: 10,
};

function challenge(overrides: Record<string, unknown> = {}) {
  return {
    id: "challenge-1",
    challengerDuoId: "duo-a",
    challengedDuoId: "duo-b",
    status: "UNPLAYED_TIMEOUT",
    respondedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfigNumber.mockImplementation(async (key: string) => {
    if (key in CONFIG) return CONFIG[key];
    throw new Error(`onverwachte config-key in test: ${key}`);
  });
  mockPrisma.duoMembership.findFirst.mockResolvedValue({ id: "membership-1" });
  mockPrisma.dispute.findUnique.mockResolvedValue(null);
});

describe("openMatchScoreDispute", () => {
  it("maakt een open dispute aan voor een betwiste match", async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({ id: "match-1", status: "DISPUTED", challengeId: "challenge-1" });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(challenge());
    mockPrisma.dispute.create.mockResolvedValueOnce({ id: "dispute-1" });

    const result = await openMatchScoreDispute("match-1", "user-1", "Score klopt niet");

    expect(result).toEqual({ id: "dispute-1" });
    expect(mockPrisma.dispute.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ matchId: "match-1", subject: "MATCH_SCORE", reason: "Score klopt niet" }),
      }),
    );
  });

  it("weigert een dispute voor een match die niet disputed is", async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({ id: "match-1", status: "COMPLETED", challengeId: "challenge-1" });

    await expect(openMatchScoreDispute("match-1", "user-1", "reden")).rejects.toMatchObject({
      code: "match_not_disputed",
    });
  });

  it("weigert een niet-lid van beide duo's", async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({ id: "match-1", status: "DISPUTED", challengeId: "challenge-1" });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(challenge());
    mockPrisma.duoMembership.findFirst.mockResolvedValue(null);

    await expect(openMatchScoreDispute("match-1", "user-1", "reden")).rejects.toMatchObject({
      code: "not_a_member",
    });
  });

  it("weigert een tweede dispute voor dezelfde match", async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({ id: "match-1", status: "DISPUTED", challengeId: "challenge-1" });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(challenge());
    mockPrisma.dispute.findUnique.mockResolvedValueOnce({ id: "existing-dispute" });

    await expect(openMatchScoreDispute("match-1", "user-1", "reden")).rejects.toMatchObject({
      code: "dispute_already_exists",
    });
  });
});

describe("openForfeitDispute", () => {
  it("maakt een open forfeit-dispute aan binnen de termijn", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(challenge());
    mockPrisma.dispute.create.mockResolvedValueOnce({ id: "dispute-2" });

    const result = await openForfeitDispute("challenge-1", "user-1", "Andere partij wilde niet plannen");

    expect(result).toEqual({ id: "dispute-2" });
    expect(mockPrisma.dispute.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ challengeId: "challenge-1", subject: "FORFEIT" }) }),
    );
  });

  it("weigert als de challenge niet unplayed_timeout is", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(challenge({ status: "ACCEPTED" }));

    await expect(openForfeitDispute("challenge-1", "user-1", "reden")).rejects.toMatchObject({
      code: "challenge_not_unplayed_timeout",
    });
  });

  it("weigert als de dispute-termijn verstreken is", async () => {
    const longAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 dagen geleden
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(challenge({ respondedAt: longAgo }));

    await expect(openForfeitDispute("challenge-1", "user-1", "reden")).rejects.toMatchObject({
      code: "dispute_window_passed",
    });
  });
});

describe("resolveMatchScoreDispute", () => {
  it("upheld: hergebruikt finalizeMatch (dezelfde ELO-verwerking als bevestigen)", async () => {
    mockPrisma.dispute.findUnique.mockResolvedValueOnce({
      id: "dispute-1",
      subject: "MATCH_SCORE",
      matchId: "match-1",
      status: "OPEN",
    });

    await resolveMatchScoreDispute("dispute-1", "admin-1", "upheld", "leek terecht");

    expect(mockFinalizeMatch).toHaveBeenCalledWith(
      "match-1",
      expect.objectContaining({ fromStatuses: ["DISPUTED"] }),
    );
    expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVED_UPHELD" }) }),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "dispute_resolved" }) }),
    );
  });

  it("overturned: zet de match op voided, geen ELO-verwerking", async () => {
    mockPrisma.dispute.findUnique.mockResolvedValueOnce({
      id: "dispute-1",
      subject: "MATCH_SCORE",
      matchId: "match-1",
      status: "OPEN",
    });

    await resolveMatchScoreDispute("dispute-1", "admin-1", "overturned");

    expect(mockFinalizeMatch).not.toHaveBeenCalled();
    expect(mockPrisma.match.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "VOIDED" } }),
    );
    expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVED_OVERTURNED" }) }),
    );
  });

  it("weigert een dispute die al is afgehandeld", async () => {
    mockPrisma.dispute.findUnique.mockResolvedValueOnce({
      id: "dispute-1",
      subject: "MATCH_SCORE",
      matchId: "match-1",
      status: "RESOLVED_UPHELD",
    });

    await expect(resolveMatchScoreDispute("dispute-1", "admin-1", "upheld")).rejects.toMatchObject({
      code: "dispute_not_open",
    });
  });
});

describe("resolveForfeitDispute", () => {
  it("upheld: laat de bestaande penalty bij beide duo's ongewijzigd", async () => {
    mockPrisma.dispute.findUnique.mockResolvedValueOnce({
      id: "dispute-2",
      subject: "FORFEIT",
      challengeId: "challenge-1",
      status: "OPEN",
    });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(challenge());

    await resolveForfeitDispute("dispute-2", "admin-1", "upheld");

    expect(mockPrisma.duo.update).not.toHaveBeenCalled();
    expect(mockPrisma.ratingHistory.create).not.toHaveBeenCalled();
    expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVED_UPHELD" }) }),
    );
  });

  it("overturned: draait de penalty van de onschuldige partij terug via een NIEUW correctie-record", async () => {
    mockPrisma.dispute.findUnique.mockResolvedValueOnce({
      id: "dispute-2",
      subject: "FORFEIT",
      challengeId: "challenge-1",
      status: "OPEN",
    });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(challenge());
    // duo-b was ten onrechte gestraft (duo-a is at fault) -> duo-b krijgt correctie
    mockPrisma.duo.findUniqueOrThrow.mockResolvedValueOnce({ id: "duo-b", currentRating: 1190 }); // was 1200, -10

    await resolveForfeitDispute("dispute-2", "admin-1", "overturned", "duo-a", "duo-a wilde niet plannen");

    expect(mockPrisma.duo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "duo-b" }, data: { currentRating: 1200 } }),
    );
    expect(mockPrisma.ratingHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ duoId: "duo-b", challengeId: "challenge-1", isForfeit: true, ratingAfter: 1200 }),
      }),
    );
    expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVED_OVERTURNED" }) }),
    );
  });

  it("weigert een ongeldige atFaultDuoId (geen van beide betrokken duo's)", async () => {
    mockPrisma.dispute.findUnique.mockResolvedValueOnce({
      id: "dispute-2",
      subject: "FORFEIT",
      challengeId: "challenge-1",
      status: "OPEN",
    });
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(challenge());

    await expect(
      resolveForfeitDispute("dispute-2", "admin-1", "overturned", "duo-x"),
    ).rejects.toMatchObject({ code: "invalid_at_fault_duo" });
  });
});
