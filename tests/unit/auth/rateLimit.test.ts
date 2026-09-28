import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Minimale in-memory nabootsing van prisma.auditLog (create + findMany met
// de filters die de limiter gebruikt), zodat het gedrag end-to-end over de
// DB-interface getest wordt zonder echte database.
type Row = { entityType: string; entityId: string; action: string; createdAt: Date };
const rows: Row[] = [];
const mockPrisma = {
  auditLog: {
    create: vi.fn(async ({ data }: { data: Omit<Row, "createdAt"> }) => {
      const row = { ...data, createdAt: new Date() };
      rows.push(row);
      return row;
    }),
    findMany: vi.fn(
      async ({
        where,
        take,
      }: {
        where: { entityType: string; entityId: string; createdAt: { gt: Date } };
        take: number;
      }) =>
        rows
          .filter(
            (r) =>
              r.entityType === where.entityType &&
              r.entityId === where.entityId &&
              r.createdAt > where.createdAt.gt,
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, take),
    ),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  evaluateLoginLockout,
  rateLimitKeyToEntityId,
} = await import("@/lib/auth/rateLimit");

const T0 = new Date("2026-01-01T00:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

describe("login rate limiter (Postgres-backed via audit_log)", () => {
  beforeEach(() => {
    rows.length = 0;
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("laat toe zolang het maximum niet bereikt is", async () => {
    await recordFailedAttempt("key1");
    await recordFailedAttempt("key1");
    expect(await checkRateLimit("key1", 3, 15)).toEqual({ limited: false, failedAttempts: 2 });
  });

  it("blokkeert zodra het maximum aantal mislukte pogingen bereikt is", async () => {
    await recordFailedAttempt("key2");
    await recordFailedAttempt("key2");
    await recordFailedAttempt("key2");
    const status = await checkRateLimit("key2", 3, 15);
    expect(status.limited).toBe(true);
  });

  it("laat de blokkade verlopen na de lockout-periode", async () => {
    await recordFailedAttempt("key3");
    expect((await checkRateLimit("key3", 1, 15)).limited).toBe(true);

    vi.setSystemTime(at(16)); // 16 min later
    expect((await checkRateLimit("key3", 1, 15)).limited).toBe(false);
  });

  it("reset de teller bij een succesvolle poging", async () => {
    await recordFailedAttempt("key4");
    vi.setSystemTime(at(1));
    await resetRateLimit("key4");
    vi.setSystemTime(at(2));
    await recordFailedAttempt("key4");
    expect(await checkRateLimit("key4", 2, 15)).toEqual({ limited: false, failedAttempts: 1 });
  });

  it("houdt tellers per key onafhankelijk bij", async () => {
    await recordFailedAttempt("key5");
    expect((await checkRateLimit("key5", 1, 15)).limited).toBe(true);
    expect((await checkRateLimit("key6", 1, 15)).limited).toBe(false);
  });

  it("slaat de key (e-mail + IP) niet in leesbare vorm op", async () => {
    await recordFailedAttempt("speler@example.com::10.0.0.1");
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain("speler@example.com");
    expect(stored).not.toContain("10.0.0.1");
    expect(rows[0]!.entityType).toBe("login_rate_limit");
    expect(rows[0]!.action).toBe("login_failed");
  });
});

describe("evaluateLoginLockout (pure beslislogica)", () => {
  const failed = (minutes: number) => ({ action: "login_failed", createdAt: at(minutes) });
  const reset = (minutes: number) => ({ action: "login_rate_limit_reset", createdAt: at(minutes) });

  it("Retry-After loopt tot de max-ste nieuwste mislukte poging uit het venster valt", () => {
    // nieuwste eerst; max 3, venster 15 min; nu = minuut 5
    const status = evaluateLoginLockout([failed(4), failed(2), failed(1)], 3, 15, at(5));
    expect(status).toEqual({ limited: true, retryAfterSeconds: 11 * 60, failedAttempts: 3 });
  });

  it("negeert pogingen van vóór de laatste reset", () => {
    const status = evaluateLoginLockout([failed(4), reset(3), failed(2), failed(1)], 2, 15, at(5));
    expect(status).toEqual({ limited: false, failedAttempts: 1 });
  });
});

describe("rateLimitKeyToEntityId", () => {
  it("is deterministisch, uniek per key en een geldige UUID", () => {
    const a = rateLimitKeyToEntityId("a@example.com::1.2.3.4");
    expect(rateLimitKeyToEntityId("a@example.com::1.2.3.4")).toBe(a);
    expect(rateLimitKeyToEntityId("b@example.com::1.2.3.4")).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
