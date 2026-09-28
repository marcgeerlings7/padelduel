import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockPrisma = {
  auditLog: { findMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { evaluateSlidingWindow, checkApiRateLimit } = await import("@/lib/apiClient/rateLimit");

const NOW = new Date("2026-01-01T12:00:00Z");
const secondsAgo = (s: number) => new Date(NOW.getTime() - s * 1000);

describe("evaluateSlidingWindow (pure beslislogica)", () => {
  it("laat aanroepen toe zolang het maximum binnen het venster niet bereikt is", () => {
    expect(evaluateSlidingWindow([], 3, 60_000, NOW).limited).toBe(false);
    expect(evaluateSlidingWindow([secondsAgo(1), secondsAgo(2)], 3, 60_000, NOW).limited).toBe(false);
  });

  it("blokkeert zodra het maximum binnen het venster bereikt is, met Retry-After tot de oudste meegetelde aanroep vervalt", () => {
    const result = evaluateSlidingWindow([secondsAgo(5), secondsAgo(20)], 2, 60_000, NOW);
    expect(result.limited).toBe(true);
    // de oudste meegetelde aanroep (20s geleden) valt over 40s uit het venster
    expect(result.retryAfterSeconds).toBe(40);
  });

  it("gebruikt de max-ste nieuwste aanroep, niet de allereerste, als er meer rijen zijn dan het maximum", () => {
    const result = evaluateSlidingWindow([secondsAgo(1), secondsAgo(10), secondsAgo(50)], 2, 60_000, NOW);
    expect(result).toEqual({ limited: true, retryAfterSeconds: 50 });
  });

  it("geeft altijd minimaal 1 seconde Retry-After", () => {
    const result = evaluateSlidingWindow([secondsAgo(60)], 1, 60_000, NOW);
    expect(result).toEqual({ limited: true, retryAfterSeconds: 1 });
  });

  it("blokkeert alles bij een maximum van 0", () => {
    expect(evaluateSlidingWindow([], 0, 60_000, NOW)).toEqual({ limited: true, retryAfterSeconds: 60 });
  });
});

describe("checkApiRateLimit (Postgres-backed via audit_log)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("telt alleen gelogde aanroepen van déze client binnen het venster, exclusief eerder geweigerde (429)", async () => {
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);

    await checkApiRateLimit("client-1", 60, 60_000);

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        entityType: "api_client",
        entityId: "client-1",
        action: "availability_api_call",
        createdAt: { gt: secondsAgo(60) },
        NOT: { payload: { path: ["statusCode"], equals: 429 } },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
  });

  it("geeft limited + Retry-After terug als het maximum in de database bereikt is", async () => {
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([
      { createdAt: secondsAgo(2) },
      { createdAt: secondsAgo(30) },
    ]);

    await expect(checkApiRateLimit("client-1", 2, 60_000)).resolves.toEqual({
      limited: true,
      retryAfterSeconds: 30,
    });
  });

  it("laat door als er minder meegetelde aanroepen zijn dan het maximum", async () => {
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([{ createdAt: secondsAgo(2) }]);
    await expect(checkApiRateLimit("client-1", 2, 60_000)).resolves.toEqual({ limited: false });
  });
});
