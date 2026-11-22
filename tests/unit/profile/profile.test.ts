import { describe, it, expect, vi, beforeEach } from "vitest";
import { displayNameSchema, updateProfileSchema } from "@/lib/profile/validation";
import { publicDisplayName } from "@/lib/profile/displayName";
import { registerSchema } from "@/lib/auth/validation";

const mockPrisma = {
  user: { findUnique: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { getMyProfile, updateMyProfile, requestKnltbVerification } = await import("@/server/services/profileService");

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
  it("is verplicht", () => {
    expect(registerSchema.safeParse(base).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, displayName: "   " }).success).toBe(false);
  });
  it("wordt gevalideerd en genormaliseerd", () => {
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
  const row = {
    id: "u1",
    email: "u1@example.com",
    role: "USER",
    displayName: null,
    knltbLevel: null,
    knltbLevelVerifiedAt: null,
    knltbVerificationRequestedAt: null,
  };

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
      knltbVerification: "none",
    });
    expect(profile.publicName).toMatch(/^Speler /);
  });

  it("getMyProfile: 404 voor een onbekende gebruiker", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(getMyProfile("x")).rejects.toMatchObject({ code: "user_not_found", httpStatus: 404 });
  });

  it("updateMyProfile wijzigt alleen meegegeven velden", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u1", knltbLevel: 6 });
    mockPrisma.user.update.mockResolvedValueOnce({ ...row, displayName: "Jan", knltbLevel: 6 });
    const profile = await updateMyProfile("u1", { displayName: "Jan", knltbLevel: 6 });
    // Ongewijzigde speelsterkte: verificatie blijft staan.
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, data: { displayName: "Jan", knltbLevel: 6 } }),
    );
    expect(profile).toMatchObject({ displayName: "Jan", publicName: "Jan", hasDisplayName: true, knltbLevel: 6 });
  });

  it("updateMyProfile kan de speelsterkte wissen", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u1", knltbLevel: null });
    mockPrisma.user.update.mockResolvedValueOnce(row);
    await updateMyProfile("u1", { knltbLevel: null });
    expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({ knltbLevel: null });
  });

  it("updateMyProfile: een gewijzigde speelsterkte wist verificatie en openstaande aanvraag", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u1", knltbLevel: 3 });
    mockPrisma.user.update.mockResolvedValueOnce({ ...row, knltbLevel: 2 });
    const profile = await updateMyProfile("u1", { knltbLevel: 2 });
    expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({
      knltbLevel: 2,
      knltbLevelVerifiedAt: null,
      knltbLevelVerifiedBy: { disconnect: true },
      knltbVerificationRequestedAt: null,
    });
    expect(profile.knltbVerification).toBe("none");
  });

  it("getMyProfile toont de verificatiestatus", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...row, knltbLevel: 2, knltbVerificationRequestedAt: new Date() });
    expect((await getMyProfile("u1")).knltbVerification).toBe("requested");
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...row, knltbLevel: 2, knltbLevelVerifiedAt: new Date() });
    expect((await getMyProfile("u1")).knltbVerification).toBe("verified");
  });
});

describe("requestKnltbVerification (laag C)", () => {
  const base = {
    id: "u1",
    email: "u1@example.com",
    role: "USER",
    displayName: "Jan",
    knltbLevel: 2,
    knltbLevelVerifiedAt: null,
    knltbVerificationRequestedAt: null,
  };

  beforeEach(() => vi.clearAllMocks());

  it("zet de aanvraagdatum", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(base);
    mockPrisma.user.update.mockImplementationOnce(async (args: { data: Record<string, unknown> }) => ({ ...base, ...args.data }));
    const profile = await requestKnltbVerification("u1");
    expect(mockPrisma.user.update.mock.calls[0][0].data.knltbVerificationRequestedAt).toBeInstanceOf(Date);
    expect(profile.knltbVerification).toBe("requested");
  });

  it("zonder speelsterkte: 400", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...base, knltbLevel: null });
    await expect(requestKnltbVerification("u1")).rejects.toMatchObject({ code: "knltb_level_missing", httpStatus: 400 });
  });

  it("al geverifieerd: 409", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...base, knltbLevelVerifiedAt: new Date() });
    await expect(requestKnltbVerification("u1")).rejects.toMatchObject({ code: "already_verified", httpStatus: 409 });
  });

  it("idempotent: een tweede aanvraag wijzigt niets", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...base, knltbVerificationRequestedAt: new Date("2026-11-01") });
    const profile = await requestKnltbVerification("u1");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(profile.knltbVerification).toBe("requested");
  });

  it("onbekende gebruiker: 404", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(requestKnltbVerification("x")).rejects.toMatchObject({ code: "user_not_found", httpStatus: 404 });
  });
});
