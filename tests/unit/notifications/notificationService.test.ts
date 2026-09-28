import { describe, it, expect, vi, beforeEach } from "vitest";

type LogKey = { userId: string; type: string; entityId: string; occurrenceKey: string };
const claimed = new Set<string>();
const keyOf = (k: LogKey) => `${k.userId}|${k.type}|${k.entityId}|${k.occurrenceKey}`;

const mockPrisma = {
  duoMembership: { findMany: vi.fn(), findFirst: vi.fn() },
  notificationPreference: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  notificationLog: {
    createMany: vi.fn(async ({ data }: { data: LogKey[] }) => {
      let count = 0;
      for (const row of data) {
        if (!claimed.has(keyOf(row))) {
          claimed.add(keyOf(row));
          count++;
        }
      }
      return { count };
    }),
    deleteMany: vi.fn(async ({ where }: { where: LogKey }) => {
      claimed.delete(keyOf(where));
      return { count: 1 };
    }),
  },
  challenge: { findUnique: vi.fn(), findMany: vi.fn() },
  match: { findUnique: vi.fn(), findMany: vi.fn() },
  dispute: { findUnique: vi.fn() },
  challengePostponement: { findUnique: vi.fn() },
};

const mockSendEmail = vi.fn();
const mockGetConfigNumber = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/server/repositories/platformConfigRepository", () => ({ getConfigNumber: mockGetConfigNumber }));

const {
  deliverNotification,
  notifySafely,
  notifyChallengeReceived,
  notifyScoreSubmitted,
  notifyDisputeResolved,
  notifyPostponementRequested,
  notifyPostponementAnswered,
  sendDueReminders,
  getNotificationPreferences,
  updateNotificationPreferences,
} = await import("@/server/services/notificationService");

const HOUR = 60 * 60 * 1000;
const duoA = { id: "duo-a", name: "Net Ninjas" };
const duoB = { id: "duo-b", name: "Smash Sisters" };
const MEMBERS: Record<string, Array<{ id: string; email: string; displayName: string | null }>> = {
  "duo-a": [
    { id: "u1", email: "u1@example.com", displayName: "Anna" },
    { id: "u2", email: "u2@example.com", displayName: null },
  ],
  "duo-b": [
    { id: "u3", email: "u3@example.com", displayName: "Bram" },
    { id: "u4", email: "u4@example.com", displayName: "Bo" },
  ],
};

function challengeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "challenge-1",
    status: "PENDING",
    challengerDuoId: "duo-a",
    challengedDuoId: "duo-b",
    challengerDuo: duoA,
    challengedDuo: duoB,
    responseDeadline: new Date(Date.now() + 10 * HOUR),
    matchDeadline: new Date(Date.now() + 20 * HOUR),
    ...overrides,
  };
}

const recipientsOf = () => mockSendEmail.mock.calls.map((c) => c[0].to).sort();

beforeEach(() => {
  vi.clearAllMocks();
  claimed.clear();
  mockSendEmail.mockResolvedValue({ ok: true, provider: "console" });
  mockPrisma.notificationPreference.findMany.mockResolvedValue([]);
  mockPrisma.duoMembership.findMany.mockImplementation(async ({ where }: { where: { duoId: string } }) =>
    (MEMBERS[where.duoId] ?? []).map((user) => ({ user })),
  );
  mockGetConfigNumber.mockImplementation(async (key: string) => {
    if (key === "notification_response_deadline_lead_hours") return 24;
    if (key === "notification_match_deadline_lead_hours") return 48;
    if (key === "notification_auto_confirm_lead_hours") return 12;
    throw new Error(`onverwachte key ${key}`);
  });
});

describe("deliverNotification", () => {
  const content = {
    kind: "CHALLENGE_RECEIVED" as const,
    challengerDuoName: "A",
    challengedDuoName: "B",
    responseDeadline: new Date(),
  };

  it("stuurt elke ontvanger een eigen mail met eigen begroeting (fallback-naam, nooit e-mail)", async () => {
    const stats = await deliverNotification({
      recipients: MEMBERS["duo-a"],
      kind: "CHALLENGE_RECEIVED",
      entityId: "c1",
      content,
    });
    expect(stats).toEqual({ sent: 2, skippedPreference: 0, skippedDuplicate: 0, failed: 0 });
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    const toU2 = mockSendEmail.mock.calls.find((c) => c[0].to === "u2@example.com")![0];
    expect(toU2.body).toMatch(/^Hoi Speler /);
    expect(toU2.body).not.toContain("u1@example.com");
  });

  it("is idempotent: een tweede aanroep verstuurt niets", async () => {
    await deliverNotification({ recipients: MEMBERS["duo-a"], kind: "CHALLENGE_RECEIVED", entityId: "c1", content });
    const second = await deliverNotification({
      recipients: MEMBERS["duo-a"],
      kind: "CHALLENGE_RECEIVED",
      entityId: "c1",
      content,
    });
    expect(second).toEqual({ sent: 0, skippedPreference: 0, skippedDuplicate: 2, failed: 0 });
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });

  it("respecteert opt-out per soort", async () => {
    mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([
      { userId: "u1", challengeReceived: false, challengeResponseReminder: true, matchDeadlineReminder: true, scoreConfirmation: true, disputeResolved: true, postponement: true },
    ]);
    const stats = await deliverNotification({
      recipients: MEMBERS["duo-a"],
      kind: "CHALLENGE_RECEIVED",
      entityId: "c1",
      content,
    });
    expect(stats.sent).toBe(1);
    expect(stats.skippedPreference).toBe(1);
    expect(recipientsOf()).toEqual(["u2@example.com"]);
  });

  it("geeft de claim vrij als verzenden mislukt, zodat een volgende run het opnieuw probeert", async () => {
    mockSendEmail.mockResolvedValueOnce({ ok: false, provider: "resend", error: "HTTP 500" });
    const stats = await deliverNotification({
      recipients: [MEMBERS["duo-a"][0]],
      kind: "CHALLENGE_RECEIVED",
      entityId: "c1",
      content,
    });
    expect(stats.failed).toBe(1);
    expect(mockPrisma.notificationLog.deleteMany).toHaveBeenCalled();
    const retry = await deliverNotification({
      recipients: [MEMBERS["duo-a"][0]],
      kind: "CHALLENGE_RECEIVED",
      entityId: "c1",
      content,
    });
    expect(retry.sent).toBe(1);
  });

  it("dedupliceert een ontvanger die dubbel in de lijst staat", async () => {
    const stats = await deliverNotification({
      recipients: [MEMBERS["duo-a"][0], MEMBERS["duo-a"][0]],
      kind: "CHALLENGE_RECEIVED",
      entityId: "c1",
      content,
    });
    expect(stats.sent).toBe(1);
  });

  it("een DB-fout bij één ontvanger telt als failed en stopt de rest niet", async () => {
    mockPrisma.notificationLog.createMany.mockRejectedValueOnce(new Error("db weg"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const stats = await deliverNotification({
      recipients: MEMBERS["duo-a"],
      kind: "CHALLENGE_RECEIVED",
      entityId: "c1",
      content,
    });
    expect(stats).toMatchObject({ sent: 1, failed: 1 });
    errorSpy.mockRestore();
  });
});

describe("notifySafely", () => {
  it("slikt fouten in (hoofdactie mag nooit breken) en logt", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifySafely("test", async () => Promise.reject(new Error("boem")))).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("event-notificaties", () => {
  it("nieuwe uitdaging → alleen de leden van het uitgedaagde duo", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(challengeRow());
    await notifyChallengeReceived("challenge-1");
    expect(recipientsOf()).toEqual(["u3@example.com", "u4@example.com"]);
    expect(mockSendEmail.mock.calls[0][0].subject).toContain("Nieuwe uitdaging voor Smash Sisters");
  });

  it("nieuwe uitdaging die al niet meer pending is → niets", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValueOnce(challengeRow({ status: "DECLINED" }));
    await notifyChallengeReceived("challenge-1");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("score ingediend door de uitdager → alleen het uitgedaagde duo moet bevestigen", async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "AWAITING_CONFIRMATION",
      submittedBy: "u1",
      scoreRaw: "6-0,6-0",
      resultType: "WALKOVER",
      autoConfirmDeadline: new Date(Date.now() + 48 * HOUR),
      challenge: challengeRow({ status: "ACCEPTED" }),
    });
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce({ id: "membership" }); // u1 in challenger-duo
    await notifyScoreSubmitted("m1");
    expect(recipientsOf()).toEqual(["u3@example.com", "u4@example.com"]);
    expect(mockSendEmail.mock.calls[0][0].body).toContain("(walkover)");
  });

  it("score ingediend door de uitgedaagde → het uitdagende duo", async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "AWAITING_CONFIRMATION",
      submittedBy: "u3",
      scoreRaw: "6-4,6-4",
      resultType: "PLAYED",
      autoConfirmDeadline: new Date(Date.now() + 48 * HOUR),
      challenge: challengeRow({ status: "ACCEPTED" }),
    });
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce(null);
    await notifyScoreSubmitted("m1");
    expect(recipientsOf()).toEqual(["u1@example.com", "u2@example.com"]);
  });

  it("geschil afgehandeld → beide duo's, elk met hun eigen duo-naam", async () => {
    mockPrisma.dispute.findUnique.mockResolvedValueOnce({
      id: "d1",
      status: "RESOLVED_OVERTURNED",
      subject: "MATCH_SCORE",
      match: { challenge: challengeRow({ status: "ACCEPTED" }) },
      challenge: null,
    });
    const stats = await notifyDisputeResolved("d1");
    expect(stats.sent).toBe(4);
    const toU1 = mockSendEmail.mock.calls.find((c) => c[0].to === "u1@example.com")![0];
    expect(toU1.subject).toContain("Net Ninjas – Smash Sisters");
    expect(toU1.body).toContain("opnieuw spelen");
  });

  it("open geschil → niets", async () => {
    mockPrisma.dispute.findUnique.mockResolvedValueOnce({ id: "d1", status: "OPEN" });
    expect((await notifyDisputeResolved("d1")).sent).toBe(0);
  });

  it("uitstel gevraagd → het ANDERE duo; beantwoord → het vragende duo", async () => {
    const postponement = {
      id: "p1",
      status: "PENDING",
      requestedByDuoId: "duo-b",
      requestedDays: 3,
      reason: null,
      newMatchDeadline: null,
      challenge: challengeRow({ status: "ACCEPTED" }),
    };
    mockPrisma.challengePostponement.findUnique.mockResolvedValueOnce(postponement);
    await notifyPostponementRequested("p1");
    expect(recipientsOf()).toEqual(["u1@example.com", "u2@example.com"]);

    mockSendEmail.mockClear();
    mockPrisma.challengePostponement.findUnique.mockResolvedValueOnce({
      ...postponement,
      status: "ACCEPTED",
      newMatchDeadline: new Date(),
    });
    await notifyPostponementAnswered("p1");
    expect(recipientsOf()).toEqual(["u3@example.com", "u4@example.com"]);
    expect(mockSendEmail.mock.calls[0][0].subject).toContain("akkoord");
  });

  it("ingetrokken uitstel → geen 'beantwoord'-mail", async () => {
    mockPrisma.challengePostponement.findUnique.mockResolvedValueOnce({ id: "p1", status: "CANCELLED" });
    expect((await notifyPostponementAnswered("p1")).sent).toBe(0);
  });
});

describe("sendDueReminders", () => {
  const now = new Date("2026-10-01T12:00:00Z");

  beforeEach(() => {
    mockPrisma.challenge.findMany.mockResolvedValue([]);
    mockPrisma.match.findMany.mockResolvedValue([]);
  });

  it("zoekt alleen deadlines in de toekomst binnen de lead-tijd", async () => {
    await sendDueReminders(now);
    const [pendingQuery, acceptedQuery] = mockPrisma.challenge.findMany.mock.calls.map((c) => c[0].where);
    expect(pendingQuery).toMatchObject({
      status: "PENDING",
      responseDeadline: { gt: now, lte: new Date(now.getTime() + 24 * HOUR) },
    });
    expect(acceptedQuery).toMatchObject({
      status: "ACCEPTED",
      matchDeadline: { gt: now, lte: new Date(now.getTime() + 48 * HOUR) },
      matches: { none: { status: { not: "VOIDED" } } },
    });
    expect(mockPrisma.match.findMany.mock.calls[0][0].where).toMatchObject({
      status: "AWAITING_CONFIRMATION",
      autoConfirmDeadline: { gt: now, lte: new Date(now.getTime() + 12 * HOUR) },
    });
  });

  it("speeltermijn-herinnering naar beide duo's, en niet opnieuw bij een tweede run", async () => {
    const deadline = new Date(now.getTime() + 30 * HOUR);
    mockPrisma.challenge.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([challengeRow({ status: "ACCEPTED", matchDeadline: deadline })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([challengeRow({ status: "ACCEPTED", matchDeadline: deadline })]);

    const first = await sendDueReminders(now);
    expect(first.matchDeadlineReminders.sent).toBe(4);
    const second = await sendDueReminders(now);
    expect(second.matchDeadlineReminders).toMatchObject({ sent: 0, skippedDuplicate: 4 });
    expect(mockSendEmail).toHaveBeenCalledTimes(4);
  });

  it("na een verlengde deadline (uitstel) volgt wél een nieuwe herinnering", async () => {
    const d1 = new Date(now.getTime() + 30 * HOUR);
    const d2 = new Date(now.getTime() + 40 * HOUR);
    mockPrisma.challenge.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([challengeRow({ status: "ACCEPTED", matchDeadline: d1 })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([challengeRow({ status: "ACCEPTED", matchDeadline: d2 })]);
    await sendDueReminders(now);
    const second = await sendDueReminders(now);
    expect(second.matchDeadlineReminders.sent).toBe(4);
  });

  it("reactietermijn-herinnering alleen naar het uitgedaagde duo", async () => {
    mockPrisma.challenge.findMany.mockResolvedValueOnce([challengeRow()]).mockResolvedValueOnce([]);
    const result = await sendDueReminders(now);
    expect(result.challengeResponseReminders.sent).toBe(2);
    expect(recipientsOf()).toEqual(["u3@example.com", "u4@example.com"]);
  });

  it("auto-confirm-herinnering naar het duo dat moet bevestigen", async () => {
    mockPrisma.match.findMany.mockResolvedValueOnce([{ id: "m1" }]);
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "AWAITING_CONFIRMATION",
      submittedBy: "u1",
      scoreRaw: "6-4,6-4",
      resultType: "PLAYED",
      autoConfirmDeadline: new Date(now.getTime() + 5 * HOUR),
      challenge: challengeRow({ status: "ACCEPTED" }),
    });
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce({ id: "m" });
    const result = await sendDueReminders(now);
    expect(result.autoConfirmReminders.sent).toBe(2);
    expect(mockPrisma.notificationLog.createMany.mock.calls[0][0].data[0]).toMatchObject({
      type: "AUTO_CONFIRM_REMINDER",
      entityId: "m1",
    });
  });
});

describe("voorkeuren", () => {
  it("zonder rij: alles aan", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce(null);
    expect(await getNotificationPreferences("u1")).toEqual({
      challengeReceived: true,
      challengeResponseReminder: true,
      matchDeadlineReminder: true,
      scoreConfirmation: true,
      disputeResolved: true,
      postponement: true,
    });
  });

  it("update is een upsert met alleen de meegegeven keys", async () => {
    mockPrisma.notificationPreference.upsert.mockResolvedValueOnce({
      userId: "u1",
      challengeReceived: true,
      challengeResponseReminder: true,
      matchDeadlineReminder: false,
      scoreConfirmation: true,
      disputeResolved: true,
      postponement: true,
    });
    const prefs = await updateNotificationPreferences("u1", { matchDeadlineReminder: false });
    expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId: "u1" },
      create: { userId: "u1", matchDeadlineReminder: false },
      update: { matchDeadlineReminder: false },
    });
    expect(prefs.matchDeadlineReminder).toBe(false);
  });
});
