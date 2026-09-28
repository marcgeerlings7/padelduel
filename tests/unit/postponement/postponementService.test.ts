import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const mockPrisma = {
  challenge: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  duoMembership: { findMany: vi.fn() },
  match: { findFirst: vi.fn() },
  challengePostponement: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $queryRaw: vi.fn(async () => [{ id: "locked" }]),
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

const mockGetConfigNumber = vi.fn();
const mockNotifyRequested = vi.fn();
const mockNotifyAnswered = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/repositories/platformConfigRepository", () => ({ getConfigNumber: mockGetConfigNumber }));
vi.mock("@/server/services/notificationService", () => ({
  notifySafely: async (_label: string, action: () => Promise<unknown>) => {
    await action();
  },
  notifyPostponementRequested: mockNotifyRequested,
  notifyPostponementAnswered: mockNotifyAnswered,
}));

const { requestPostponement, answerPostponement, getPostponementOverview } = await import(
  "@/server/services/postponementService"
);

const DAY = 24 * 60 * 60 * 1000;
const deadline = new Date(Date.now() + 3 * DAY);

function challenge(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    status: "ACCEPTED",
    challengerDuoId: "duo-a",
    challengedDuoId: "duo-b",
    matchDeadline: deadline,
    ...overrides,
  };
}

function postponementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    challengeId: "c1",
    requestedByDuoId: "duo-a",
    requestedByUserId: "u1",
    requestedDays: 5,
    reason: null,
    status: "PENDING",
    previousMatchDeadline: null,
    newMatchDeadline: null,
    createdAt: new Date(),
    respondedAt: null,
    requestedByDuo: { name: "Net Ninjas" },
    challenge: { matchDeadline: deadline },
    ...overrides,
  };
}

function memberOf(...duoIds: string[]) {
  mockPrisma.duoMembership.findMany.mockResolvedValueOnce(duoIds.map((duoId) => ({ duoId })));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfigNumber.mockImplementation(async (key: string) => {
    if (key === "postponement_max_days") return 7;
    if (key === "postponement_max_per_challenge") return 1;
    throw new Error(key);
  });
  mockPrisma.challenge.findUnique.mockResolvedValue(challenge());
  mockPrisma.challenge.findUniqueOrThrow.mockResolvedValue(challenge());
  mockPrisma.match.findFirst.mockResolvedValue(null);
  mockPrisma.challengePostponement.findFirst.mockResolvedValue(null);
  mockPrisma.challengePostponement.count.mockResolvedValue(0);
  mockPrisma.challengePostponement.create.mockResolvedValue({ id: "p1" });
  mockPrisma.challengePostponement.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.challengePostponement.findUniqueOrThrow.mockResolvedValue(postponementRow());
});

describe("requestPostponement", () => {
  it("maakt een pending verzoek aan onder rij-lock, met audit-log en notificatie ná commit", async () => {
    memberOf("duo-a");
    const dto = await requestPostponement("c1", "u1", { days: 5, reason: "Blessure" });

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1); // FOR UPDATE
    expect(mockPrisma.challengePostponement.create).toHaveBeenCalledWith({
      data: {
        challengeId: "c1",
        requestedByDuoId: "duo-a",
        requestedByUserId: "u1",
        requestedDays: 5,
        reason: "Blessure",
      },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "postponement_requested" }) }),
    );
    expect(mockNotifyRequested).toHaveBeenCalledWith("p1");
    expect(dto).toMatchObject({ id: "p1", status: "pending", requestedDays: 5 });
    expect(dto.proposedMatchDeadline).toBe(new Date(deadline.getTime() + 5 * DAY).toISOString());
  });

  it.each([0, 8])("weigert %i dagen (buiten 1..postponement_max_days)", async (days) => {
    await expect(requestPostponement("c1", "u1", { days })).rejects.toMatchObject({ code: "invalid_days" });
  });

  it("weigert een niet-lid", async () => {
    memberOf();
    await expect(requestPostponement("c1", "u9", { days: 2 })).rejects.toMatchObject({ code: "not_a_member" });
  });

  it("lid van beide duo's zonder duoId → ambiguous_duo; met duoId → ok", async () => {
    memberOf("duo-a", "duo-b");
    await expect(requestPostponement("c1", "u1", { days: 2 })).rejects.toMatchObject({ code: "ambiguous_duo" });
    memberOf("duo-a", "duo-b");
    await requestPostponement("c1", "u1", { days: 2, duoId: "duo-b" });
    expect(mockPrisma.challengePostponement.create.mock.calls[0][0].data.requestedByDuoId).toBe("duo-b");
  });

  it("weigert een duoId waar je geen lid van bent", async () => {
    memberOf("duo-a");
    await expect(requestPostponement("c1", "u1", { days: 2, duoId: "duo-b" })).rejects.toMatchObject({
      code: "not_a_member",
    });
  });

  it("controleert ná de lock: challenge niet (meer) accepted", async () => {
    memberOf("duo-a");
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(challenge({ status: "UNPLAYED_TIMEOUT" }));
    await expect(requestPostponement("c1", "u1", { days: 2 })).rejects.toMatchObject({
      code: "challenge_not_accepted",
    });
    expect(mockPrisma.challengePostponement.create).not.toHaveBeenCalled();
    expect(mockNotifyRequested).not.toHaveBeenCalled();
  });

  it("weigert na de deadline", async () => {
    memberOf("duo-a");
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(challenge({ matchDeadline: new Date(Date.now() - 1000) }));
    await expect(requestPostponement("c1", "u1", { days: 2 })).rejects.toMatchObject({
      code: "match_deadline_passed",
    });
  });

  it("weigert als er al een score is", async () => {
    memberOf("duo-a");
    mockPrisma.match.findFirst.mockResolvedValueOnce({ id: "m1" });
    await expect(requestPostponement("c1", "u1", { days: 2 })).rejects.toMatchObject({
      code: "score_already_submitted",
    });
  });

  it("weigert een tweede openstaand verzoek (check én unique-index-vangnet)", async () => {
    memberOf("duo-a");
    mockPrisma.challengePostponement.findFirst.mockResolvedValueOnce({ id: "p0" });
    await expect(requestPostponement("c1", "u1", { days: 2 })).rejects.toMatchObject({
      code: "postponement_already_pending",
    });

    memberOf("duo-a");
    mockPrisma.challengePostponement.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "5" }),
    );
    await expect(requestPostponement("c1", "u1", { days: 2 })).rejects.toMatchObject({
      code: "postponement_already_pending",
      httpStatus: 409,
    });
  });

  it("weigert als het maximum aantal geaccepteerde verzoeken bereikt is", async () => {
    memberOf("duo-a");
    mockPrisma.challengePostponement.count.mockResolvedValueOnce(1);
    await expect(requestPostponement("c1", "u1", { days: 2 })).rejects.toMatchObject({
      code: "postponement_limit_reached",
    });
  });
});

describe("answerPostponement", () => {
  beforeEach(() => {
    mockPrisma.challengePostponement.findUnique.mockResolvedValue(postponementRow());
  });

  it("accepteren verschuift de deadline met N dagen (vanaf de deadline op het moment van accepteren)", async () => {
    memberOf("duo-b");
    mockPrisma.challengePostponement.findUniqueOrThrow.mockResolvedValueOnce(
      postponementRow({ status: "ACCEPTED" }),
    );
    const dto = await answerPostponement("c1", "p1", "u3", "accept");

    const expected = new Date(deadline.getTime() + 5 * DAY);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.challengePostponement.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", status: "PENDING" },
      data: expect.objectContaining({
        status: "ACCEPTED",
        respondedByUserId: "u3",
        previousMatchDeadline: deadline,
        newMatchDeadline: expected,
      }),
    });
    expect(mockPrisma.challenge.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { matchDeadline: expected } });
    expect(mockNotifyAnswered).toHaveBeenCalledWith("p1");
    expect(dto.status).toBe("accepted");
  });

  it("alleen het ANDERE duo mag accepteren/weigeren", async () => {
    memberOf("duo-a");
    await expect(answerPostponement("c1", "p1", "u2", "accept")).rejects.toMatchObject({ code: "not_authorized" });
  });

  it("de aanvrager zelf kan niet antwoorden, ook niet als lid van beide duo's", async () => {
    memberOf("duo-a", "duo-b");
    await expect(answerPostponement("c1", "p1", "u1", "accept")).rejects.toMatchObject({
      code: "cannot_answer_own_request",
    });
  });

  it("alleen het vragende duo mag intrekken; geen 'beantwoord'-mail bij intrekken", async () => {
    memberOf("duo-b");
    await expect(answerPostponement("c1", "p1", "u3", "cancel")).rejects.toMatchObject({ code: "not_authorized" });

    memberOf("duo-a");
    await answerPostponement("c1", "p1", "u2", "cancel");
    expect(mockPrisma.challengePostponement.updateMany.mock.calls[0][0].data.status).toBe("CANCELLED");
    expect(mockNotifyAnswered).not.toHaveBeenCalled();
  });

  it("weigeren laat de deadline ongemoeid", async () => {
    memberOf("duo-b");
    await answerPostponement("c1", "p1", "u3", "decline");
    expect(mockPrisma.challengePostponement.updateMany.mock.calls[0][0].data.status).toBe("DECLINED");
    expect(mockPrisma.challenge.update).not.toHaveBeenCalled();
    expect(mockNotifyAnswered).toHaveBeenCalledWith("p1");
  });

  it("dubbele/gelijktijdige reactie → postponement_not_pending (CAS), zonder deadline-wijziging", async () => {
    memberOf("duo-b");
    mockPrisma.challengePostponement.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(answerPostponement("c1", "p1", "u3", "accept")).rejects.toMatchObject({
      code: "postponement_not_pending",
    });
    expect(mockPrisma.challenge.update).not.toHaveBeenCalled();
    expect(mockNotifyAnswered).not.toHaveBeenCalled();
  });

  it("accepteren na verstrijken van de deadline wordt geweigerd", async () => {
    memberOf("duo-b");
    mockPrisma.challenge.findUniqueOrThrow.mockResolvedValueOnce(challenge({ matchDeadline: new Date(Date.now() - 1) }));
    await expect(answerPostponement("c1", "p1", "u3", "accept")).rejects.toMatchObject({
      code: "match_deadline_passed",
    });
  });

  it("accepteren boven het maximum wordt geweigerd", async () => {
    memberOf("duo-b");
    mockPrisma.challengePostponement.count.mockResolvedValueOnce(1);
    await expect(answerPostponement("c1", "p1", "u3", "accept")).rejects.toMatchObject({
      code: "postponement_limit_reached",
    });
  });

  it("verzoek van een andere challenge → 404", async () => {
    mockPrisma.challengePostponement.findUnique.mockResolvedValueOnce(postponementRow({ challengeId: "c2" }));
    await expect(answerPostponement("c1", "p1", "u3", "accept")).rejects.toMatchObject({
      code: "postponement_not_found",
      httpStatus: 404,
    });
  });
});

describe("getPostponementOverview", () => {
  it("geeft rechten per rol terug", async () => {
    mockPrisma.challengePostponement.findMany.mockResolvedValue([postponementRow()]);

    memberOf("duo-b");
    const other = await getPostponementOverview("c1", "u3");
    expect(other).toMatchObject({ canRequest: false, canRespond: true, canCancel: false, remaining: 1, maxDays: 7 });
    expect(other.pending?.id).toBe("p1");

    memberOf("duo-a");
    const requester = await getPostponementOverview("c1", "u2");
    expect(requester).toMatchObject({ canRespond: false, canCancel: true });
  });

  it("zonder verzoeken en met ruimte: canRequest", async () => {
    mockPrisma.challengePostponement.findMany.mockResolvedValue([]);
    memberOf("duo-a");
    expect(await getPostponementOverview("c1", "u1")).toMatchObject({ canRequest: true, pending: null, history: [] });
  });

  it("niet-leden krijgen 403", async () => {
    memberOf();
    await expect(getPostponementOverview("c1", "u9")).rejects.toMatchObject({ httpStatus: 403 });
  });
});
