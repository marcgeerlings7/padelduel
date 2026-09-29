import { describe, it, expect, vi, beforeEach } from "vitest";
import { displayNameSchema, updateProfileSchema } from "@/lib/profile/validation";
import { publicDisplayName } from "@/lib/profile/displayName";
import { registerSchema } from "@/lib/auth/validation";

const mockPrisma = {
  user: { findUnique: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { getMyProfile, updateMyProfile } = await import("@/server/services/profileService");

describe("displayNameSchema", () => {
  it("trimt en normaliseert spaties", () => {
    expect(displayNameSchema.parse("  Jan   de  Vries ")).toBe("Jan de Vries");
  });

  it.each(["Anne-Marie", "José O'Neill", "Speler_7", "Ö. Yılmaz"])("accepteert %s", (name) => {
    expect(displayNameSchema.safeParse(name).success).toBe(true);
  });

  it.each(["J", "   ", "jan@example.com", "<script>", "a".repeat(41)])("weigert %s", (name) => {
    expect(displayNameSchema.safeParse(name).success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("knltbLevel 1-9 of null", () => {
    expect(updateProfileSchema.safeParse({ knltbLevel: 1 }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ knltbLevel: 9 }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ knltbLevel: null }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ knltbLevel: 0 }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ knltbLevel: 10 }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ knltbLevel: 4.5 }).success).toBe(false);
  });

  it("weigert een lege patch en onbekende velden (bijv. bondsnummer)", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(updateProfileSchema.safeParse({ displayName: "Jan", bondsnummer: "123" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ email: "x@y.nl" }).success).toBe(false);
  });
});

describe("registerSchema — weergavenaam", () => {
  const base = { email: "a@b.nl", password: "Wachtwoord123" };
  it("optioneel (huidige registratiepagina stuurt hem nog niet mee)", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });
  it("wordt gevalideerd als hij wel meegestuurd wordt", () => {
    expect(registerSchema.parse({ ...base, displayName: " Jan " }).displayName).toBe("Jan");
    expect(registerSchema.safeParse({ ...base, displayName: "a@b.nl" }).success).toBe(false);
  });
});

describe("publicDisplayName", () => {
  it("gebruikt de weergavenaam", () => {
    expect(publicDisplayName({ id: "abc", displayName: "Jan" })).toBe("Jan");
  });
  it("valt terug op een neutrale naam, nooit het e-mailadres", () => {
    const name = publicDisplayName({ id: "0a1b2c3d-4e5f-4000-8000-000000000000", displayName: null });
    expect(name).toBe("Speler 0A1B2C");
    expect(publicDisplayName({ id: "0a1b2c3d-4e5f", displayName: "   " })).toBe("Speler 0A1B2C");
  });
});

describe("profileService", () => {
  const row = { id: "u1", email: "u1@example.com", role: "USER", displayName: null, knltbLevel: null };

  beforeEach(() => vi.clearAllMocks());

  it("getMyProfile geeft hasDisplayName=false en een publieke fallback", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(row);
    const profile = await getMyProfile("u1");
    expect(profile).toMatchObject({
      id: "u1",
      email: "u1@example.com",
      displayName: null,
      hasDisplayName: false,
      knltbLevel: null,
      knltbLevelIsSelfDeclared: true,
    });
    expect(profile.publicName).toMatch(/^Speler /);
  });

  it("getMyProfile: 404 voor een onbekende gebruiker", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(getMyProfile("x")).rejects.toMatchObject({ code: "user_not_found", httpStatus: 404 });
  });

  it("updateMyProfile wijzigt alleen meegegeven velden", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u1" });
    mockPrisma.user.update.mockResolvedValueOnce({ ...row, displayName: "Jan", knltbLevel: 6 });
    const profile = await updateMyProfile("u1", { displayName: "Jan", knltbLevel: 6 });
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, data: { displayName: "Jan", knltbLevel: 6 } }),
    );
    expect(profile).toMatchObject({ displayName: "Jan", publicName: "Jan", hasDisplayName: true, knltbLevel: 6 });
  });

  it("updateMyProfile kan de speelsterkte wissen", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u1" });
    mockPrisma.user.update.mockResolvedValueOnce(row);
    await updateMyProfile("u1", { knltbLevel: null });
    expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({ knltbLevel: null });
  });
});
