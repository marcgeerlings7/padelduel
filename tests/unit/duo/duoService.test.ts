import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  region: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  duo: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  duoMembership: {
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  duoInvitation: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

const mockGetConfigNumber = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/repositories/platformConfigRepository", () => ({
  getConfigNumber: mockGetConfigNumber,
}));

const { proposeDuo, respondToInvitation, dissolveDuo, DuoError } = await import(
  "@/server/services/duoService"
);

const MAX_ACTIVE_DUOS = 5;
const COOLDOWN_DAYS = 7;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfigNumber.mockImplementation(async (key: string) => {
    if (key === "max_active_duos_per_user") return MAX_ACTIVE_DUOS;
    if (key === "duo_dissolution_cooldown_days") return COOLDOWN_DAYS;
    throw new Error(`onverwachte config-key in test: ${key}`);
  });
  // Standaard: geen bestaande duo/invitation-conflicten, ruim onder het max.
  mockPrisma.duo.findFirst.mockResolvedValue(null);
  mockPrisma.duoMembership.count.mockResolvedValue(0);
  mockPrisma.duoInvitation.findFirst.mockResolvedValue(null);
});

describe("proposeDuo", () => {
  const baseParams = {
    duoName: "Smash Sisters",
    regionSlug: "utrecht",
    invitedEmail: "partner@example.com",
  };

  it("maakt een pending invitation aan bij een geldig voorstel", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "region-1", slug: "utrecht" });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      email: "partner@example.com",
      isActive: true,
    });
    mockPrisma.duoInvitation.create.mockResolvedValueOnce({ id: "invitation-1" });

    const result = await proposeDuo("user-1", baseParams);

    expect(result).toEqual({ id: "invitation-1" });
    expect(mockPrisma.duoInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          proposedByUserId: "user-1",
          invitedUserId: "user-2",
          invitationPairKey: ["user-1", "user-2"].sort().join("::"),
        }),
      }),
    );
  });

  it("verzint een naam (gimmick) als duoName wordt weggelaten", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "region-1", slug: "utrecht" });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      email: "partner@example.com",
      isActive: true,
    });
    mockPrisma.duoInvitation.create.mockResolvedValueOnce({ id: "invitation-generated" });

    const { duoName, ...paramsWithoutName } = baseParams;
    await proposeDuo("user-1", paramsWithoutName);

    const createArgs = mockPrisma.duoInvitation.create.mock.calls[0][0];
    expect(typeof createArgs.data.duoName).toBe("string");
    expect(createArgs.data.duoName.length).toBeGreaterThan(0);
  });

  it("weigert jezelf uitnodigen", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "region-1", slug: "utrecht" });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "partner@example.com",
      isActive: true,
    });

    await expect(proposeDuo("user-1", baseParams)).rejects.toMatchObject({
      code: "cannot_invite_self",
    });
  });

  it("weigert een onbekend e-mailadres", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "region-1", slug: "utrecht" });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(proposeDuo("user-1", baseParams)).rejects.toMatchObject({
      code: "user_not_found",
    });
  });

  it("weigert een voorstel als de proposer al op het maximum zit", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "region-1", slug: "utrecht" });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      email: "partner@example.com",
      isActive: true,
    });
    mockPrisma.duoMembership.count.mockResolvedValueOnce(MAX_ACTIVE_DUOS);

    await expect(proposeDuo("user-1", baseParams)).rejects.toMatchObject({
      code: "max_active_duos_reached",
    });
  });

  it("weigert een voorstel als het koppel al een actief duo samen heeft", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "region-1", slug: "utrecht" });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      email: "partner@example.com",
      isActive: true,
    });
    mockPrisma.duo.findFirst.mockResolvedValueOnce({ id: "duo-existing", isActive: true });

    await expect(proposeDuo("user-1", baseParams)).rejects.toMatchObject({
      code: "duo_already_active",
    });
  });

  it("weigert een voorstel binnen de dissolution-cooldown", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "region-1", slug: "utrecht" });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      email: "partner@example.com",
      isActive: true,
    });
    mockPrisma.duo.findFirst
      .mockResolvedValueOnce(null) // geen actief duo
      .mockResolvedValueOnce({ dissolvedAt: new Date() }); // net ontbonden

    await expect(proposeDuo("user-1", baseParams)).rejects.toMatchObject({
      code: "duo_dissolution_cooldown",
    });
  });

  it("staat een voorstel toe zodra de cooldown-periode verstreken is", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "region-1", slug: "utrecht" });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      email: "partner@example.com",
      isActive: true,
    });
    const longAgo = new Date(Date.now() - (COOLDOWN_DAYS + 1) * 24 * 60 * 60 * 1000);
    mockPrisma.duo.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ dissolvedAt: longAgo });
    mockPrisma.duoInvitation.create.mockResolvedValueOnce({ id: "invitation-2" });

    await expect(proposeDuo("user-1", baseParams)).resolves.toEqual({ id: "invitation-2" });
  });

  it("weigert een voorstel als er al een pending invitation tussen het koppel bestaat", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "region-1", slug: "utrecht" });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-2",
      email: "partner@example.com",
      isActive: true,
    });
    mockPrisma.duoInvitation.findFirst.mockResolvedValueOnce({ id: "existing-invitation" });

    await expect(proposeDuo("user-1", baseParams)).rejects.toMatchObject({
      code: "invitation_already_pending",
    });
  });
});

describe("respondToInvitation", () => {
  const invitation = {
    id: "invitation-1",
    duoName: "Smash Sisters",
    regionId: "region-1",
    proposedByUserId: "user-1",
    invitedUserId: "user-2",
    invitationPairKey: ["user-1", "user-2"].sort().join("::"),
    status: "PENDING",
  };

  it("weigeren zet status op declined", async () => {
    mockPrisma.duoInvitation.findUnique.mockResolvedValueOnce(invitation);

    await respondToInvitation("invitation-1", "user-2", "decline");

    expect(mockPrisma.duoInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DECLINED" }) }),
    );
  });

  it("accepteren maakt een duo + 2 memberships aan en markeert de invitation als accepted", async () => {
    mockPrisma.duoInvitation.findUnique.mockResolvedValueOnce(invitation);
    mockPrisma.duo.create.mockResolvedValueOnce({ id: "duo-new" });

    const result = await respondToInvitation("invitation-1", "user-2", "accept");

    expect(result).toEqual({ duoId: "duo-new" });
    expect(mockPrisma.duoMembership.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.duoInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACCEPTED", resultingDuoId: "duo-new" }),
      }),
    );
  });

  it("weigert een reactie van iemand anders dan de uitgenodigde gebruiker", async () => {
    mockPrisma.duoInvitation.findUnique.mockResolvedValueOnce(invitation);

    await expect(respondToInvitation("invitation-1", "user-3", "accept")).rejects.toMatchObject({
      code: "not_authorized",
    });
  });

  it("weigert een reactie op een reeds beantwoorde invitation", async () => {
    mockPrisma.duoInvitation.findUnique.mockResolvedValueOnce({ ...invitation, status: "DECLINED" });

    await expect(respondToInvitation("invitation-1", "user-2", "accept")).rejects.toMatchObject({
      code: "invitation_not_pending",
    });
  });

  it("weigert acceptatie als één van beide spelers op het maximum zit", async () => {
    mockPrisma.duoInvitation.findUnique.mockResolvedValueOnce(invitation);
    mockPrisma.duoMembership.count.mockResolvedValueOnce(MAX_ACTIVE_DUOS); // proposer zit vol

    await expect(respondToInvitation("invitation-1", "user-2", "accept")).rejects.toMatchObject({
      code: "max_active_duos_reached",
    });
    expect(mockPrisma.duo.create).not.toHaveBeenCalled();
  });
});

describe("dissolveDuo", () => {
  it("eerste aanvraag zet dissolutionRequestedAt/By, ontbindt nog niet", async () => {
    mockPrisma.duo.findUnique.mockResolvedValueOnce({
      id: "duo-1",
      isActive: true,
      dissolutionRequestedAt: null,
      dissolutionRequestedByUserId: null,
    });
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce({ id: "membership-1" });

    const result = await dissolveDuo("duo-1", "user-1");

    expect(result).toEqual({ status: "requested" });
    expect(mockPrisma.duo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dissolutionRequestedByUserId: "user-1" }),
      }),
    );
  });

  it("weigert dat dezelfde speler zijn eigen aanvraag bevestigt", async () => {
    mockPrisma.duo.findUnique.mockResolvedValueOnce({
      id: "duo-1",
      isActive: true,
      dissolutionRequestedAt: new Date(),
      dissolutionRequestedByUserId: "user-1",
    });
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce({ id: "membership-1" });

    await expect(dissolveDuo("duo-1", "user-1")).rejects.toMatchObject({
      code: "dissolution_already_requested_by_you",
    });
  });

  it("de andere speler bevestigt: duo wordt inactief en memberships krijgen left_at", async () => {
    mockPrisma.duo.findUnique.mockResolvedValueOnce({
      id: "duo-1",
      isActive: true,
      dissolutionRequestedAt: new Date(),
      dissolutionRequestedByUserId: "user-1",
    });
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce({ id: "membership-2" });
    mockPrisma.duo.update.mockResolvedValueOnce({ id: "duo-1" });
    mockPrisma.duoMembership.updateMany.mockResolvedValueOnce({ count: 2 });

    const result = await dissolveDuo("duo-1", "user-2");

    expect(result).toEqual({ status: "dissolved" });
    expect(mockPrisma.duo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
    );
    expect(mockPrisma.duoMembership.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ duoId: "duo-1", leftAt: null }),
      }),
    );
  });

  it("weigert een niet-lid om het duo te ontbinden", async () => {
    mockPrisma.duo.findUnique.mockResolvedValueOnce({
      id: "duo-1",
      isActive: true,
      dissolutionRequestedAt: null,
    });
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce(null);

    await expect(dissolveDuo("duo-1", "user-3")).rejects.toMatchObject({
      code: "not_a_member",
    });
  });
});
