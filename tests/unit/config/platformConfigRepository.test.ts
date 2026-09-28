import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  platformConfig: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { getConfigNumberOrDefault, __clearConfigCacheForTests } = await import(
  "@/server/repositories/platformConfigRepository"
);

beforeEach(() => {
  vi.clearAllMocks();
  __clearConfigCacheForTests();
});

describe("getConfigNumberOrDefault", () => {
  it("gebruikt de waarde uit platform_config als de rij bestaat", async () => {
    mockPrisma.platformConfig.findUnique.mockResolvedValueOnce({ key: "k", value: "1.25" });
    expect(await getConfigNumberOrDefault("k", 0.75)).toBe(1.25);
  });

  it("valt terug op de default als de rij ontbreekt, en cachet dat", async () => {
    mockPrisma.platformConfig.findUnique.mockResolvedValue(null);
    expect(await getConfigNumberOrDefault("k", 60)).toBe(60);
    expect(await getConfigNumberOrDefault("k", 60)).toBe(60);
    expect(mockPrisma.platformConfig.findUnique).toHaveBeenCalledTimes(1);
  });

  it("gooit bij een aanwezige maar ongeldige waarde (geen stille fallback)", async () => {
    mockPrisma.platformConfig.findUnique.mockResolvedValueOnce({ key: "k", value: "abc" });
    await expect(getConfigNumberOrDefault("k", 1)).rejects.toThrow(/geen geldig getal/);
  });
});
