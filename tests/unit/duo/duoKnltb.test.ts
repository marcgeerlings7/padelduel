import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * KNLTB-aanvullingen in duoService: startrating uit bestaande duo's,
 * speltype (category), namen i.p.v. id's/e-mails bij uitnodigingen.
 */
const mockPrisma = {
  region: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  duo: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  duoMembership: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  duoInvitation: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};
const mockGetConfigNumber = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/repositories/platformConfigRepository", () => ({ getConfigNumber: mockGetConfigNumber }));

const { proposeDuo, respondToInvitation, listMyInvitations, setDuoCategory } = await import(
  "@/server/services/duoService"
);

const invitation = {
  id: "invitation-1",
  duoName: "Smash Sisters",
  regionId: "region-1",
  proposedByUserId: "user-1",
  invitedUserId: "user-2",
  invitationPairKey: ["user-1", "user-2"].sort().join("::"),
  status: "PENDING",
  category: "GEMENGD",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfigNumber.mockImplementation(async (key: string) => {
    if (key === "max_active_duos_per_user") return 5;
    if (key === "duo_dissolution_cooldown_days") return 7;
    if (key === "default_start_rating") return 1200;
    throw new Error(key);
  });
  mockPrisma.duoMembership.count.mockResolvedValue(0);
  mockPrisma.duo.findFirst.mockResolvedValue(null);
  mockPrisma.duoInvitation.findFirst.mockResolvedValue(null);
});

describe("respondToInvitation — startrating", () => {
  it("nieuw duo start op het gemiddelde van beide spelers (andere actieve duo's of default)", async () => {
    mockPrisma.duoInvitation.findUnique.mockResolvedValueOnce(invitation);
    mockPrisma.duo.findMany.mockImplementation(
      async ({ where }: { where: { memberships: { some: { userId: string } } } }) =>
        where.memberships.some.userId === "user-1"
          ? [{ currentRating: 1500 }, { currentRating: 1300 }] // speler A: 1400
          : [], // speler B: default 1200
    );
    mockPrisma.duo.create.mockResolvedValueOnce({ id: "duo-new" });

    await respondToInvitation("invitation-1", "user-2", "accept");

    expect(mockPrisma.duo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ currentRating: 1300, category: "GEMENGD" }),
    });
    // Alleen ACTIEVE duo's met een actief lidmaatschap tellen mee.
    expect(mockPrisma.duo.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      memberships: { some: { userId: "user-1", leftAt: null } },
    });
  });

  it("twee nieuwe spelers: default_start_rating uit platform_config", async () => {
    mockGetConfigNumber.mockImplementation(async (key: string) => (key === "default_start_rating" ? 1000 : 5));
    mockPrisma.duoInvitation.findUnique.mockResolvedValueOnce(invitation);
    mockPrisma.duo.findMany.mockResolvedValue([]);
    mockPrisma.duo.create.mockResolvedValueOnce({ id: "duo-new" });

    await respondToInvitation("invitation-1", "user-2", "accept");

    expect(mockPrisma.duo.create.mock.calls[0][0].data.currentRating).toBe(1000);
    expect(mockPrisma.duo.create.mock.calls[0][0].data).not.toHaveProperty("matchesPlayed"); // blijft provisional (0)
  });
});

describe("proposeDuo — category", () => {
  it("slaat het speltype op de uitnodiging op", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "region-1" });
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-2", isActive: true });
    mockPrisma.duoInvitation.create.mockResolvedValueOnce({ id: "inv" });

    await proposeDuo("user-1", { regionSlug: "utrecht", invitedEmail: "p@example.com", category: "DAMES" });

    expect(mockPrisma.duoInvitation.create.mock.calls[0][0].data.category).toBe("DAMES");
  });

  it("zonder speltype: null", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "region-1" });
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-2", isActive: true });
    mockPrisma.duoInvitation.create.mockResolvedValueOnce({ id: "inv" });

    await proposeDuo("user-1", { regionSlug: "utrecht", invitedEmail: "p@example.com" });

    expect(mockPrisma.duoInvitation.create.mock.calls[0][0].data.category).toBeNull();
  });
});

describe("listMyInvitations", () => {
  it("geeft publieke namen van beide spelers, nooit e-mailadressen", async () => {
    const row = {
      ...invitation,
      proposedBy: { id: "user-1", displayName: "Anna" },
      invitedUser: { id: "0a1b2c3d-0000", displayName: null },
      region: { id: "region-1", name: "Utrecht", slug: "utrecht" },
    };
    mockPrisma.duoInvitation.findMany.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);

    const result = await listMyInvitations("0a1b2c3d-0000");

    expect(result.received[0]).toMatchObject({ proposedByName: "Anna", invitedUserName: "Speler 0A1B2C" });
    expect(result.received[0]).not.toHaveProperty("proposedBy");
    expect(JSON.stringify(result)).not.toContain("@");
    expect(mockPrisma.duoInvitation.findMany.mock.calls[0][0].include.proposedBy).toEqual({
      select: { id: true, displayName: true },
    });
  });
});

describe("setDuoCategory", () => {
  it("een actief lid zet het speltype, met audit-log", async () => {
    mockPrisma.duo.findUnique.mockResolvedValueOnce({ id: "duo-1", isActive: true, category: null });
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce({ id: "m" });

    expect(await setDuoCategory("duo-1", "user-1", "HEREN")).toEqual({ id: "duo-1", category: "HEREN" });
    expect(mockPrisma.duo.update).toHaveBeenCalledWith({ where: { id: "duo-1" }, data: { category: "HEREN" } });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "duo_category_changed", payload: { from: null, to: "HEREN" } }),
    });
  });

  it("niet-lid → 403, ontbonden duo → 404", async () => {
    mockPrisma.duo.findUnique.mockResolvedValueOnce({ id: "duo-1", isActive: true });
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce(null);
    await expect(setDuoCategory("duo-1", "user-9", null)).rejects.toMatchObject({ httpStatus: 403 });

    mockPrisma.duo.findUnique.mockResolvedValueOnce({ id: "duo-1", isActive: false });
    await expect(setDuoCategory("duo-1", "user-1", null)).rejects.toMatchObject({ httpStatus: 404 });
  });
});
