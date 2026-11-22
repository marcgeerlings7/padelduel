import { describe, it, expect, vi, beforeEach } from "vitest";

/** Laag C (akkoord PO 2026-11-22): verificatie van de speelsterkte door een admin. */
const mockPrisma = {
  user: { findUnique: vi.fn(), updateMany: vi.fn() },
  region: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};
const mockRecalculate = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/services/startRatingService", () => ({
  recalculateStartRatings: mockRecalculate,
  getStartRatingConfig: async () => ({ defaultRating: 1200, levelStep: 50, unverifiedMaxBonus: 200, verifiedMaxBonus: 400 }),
}));

const { decideVerification, recalculateRegionStartRatings } = await import("@/server/services/startRatingAdminService");

const pendingUser = { id: "u1", knltbLevel: 2, knltbVerificationRequestedAt: new Date(), knltbLevelVerifiedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockRecalculate.mockResolvedValue({ checked: 1, changed: [] });
});

describe("decideVerification", () => {
  it("goedkeuren: verifieert voorwaardelijk, logt en herberekent de duo's van de speler", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(pendingUser);
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await decideVerification("u1", "approve", "admin-1");

    const update = mockPrisma.user.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({
      id: "u1",
      knltbVerificationRequestedAt: { not: null },
      knltbLevelVerifiedAt: null,
      knltbLevel: 2,
    });
    expect(update.data).toMatchObject({ knltbLevelVerifiedById: "admin-1", knltbVerificationRequestedAt: null });
    expect(update.data.knltbLevelVerifiedAt).toBeInstanceOf(Date);
    expect(mockPrisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      entityType: "app_user",
      entityId: "u1",
      action: "knltb_level_verified",
      performedBy: "admin-1",
      payload: { knltbLevel: 2 },
    });
    expect(mockRecalculate).toHaveBeenCalledWith({ userId: "u1" }, "admin-1");
    expect(result.status).toBe("verified");
  });

  it("afwijzen: wist alleen de aanvraag, geen herberekening", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(pendingUser);
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await decideVerification("u1", "reject", "admin-1");

    expect(mockPrisma.user.updateMany.mock.calls[0][0].data).toEqual({ knltbVerificationRequestedAt: null });
    expect(mockPrisma.auditLog.create.mock.calls[0][0].data.action).toBe("knltb_level_verification_rejected");
    expect(mockRecalculate).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "rejected", recalculated: null });
  });

  it("geen openstaande aanvraag (of al beslist): 409, geen audit", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(pendingUser);
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(decideVerification("u1", "approve", "admin-1")).rejects.toMatchObject({
      code: "no_pending_request",
      httpStatus: 409,
    });
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("onbekende gebruiker: 404", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(decideVerification("x", "approve", "admin-1")).rejects.toMatchObject({ code: "user_not_found" });
  });
});

describe("recalculateRegionStartRatings", () => {
  it("onbekende regio: 404", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce(null);
    await expect(recalculateRegionStartRatings("r-x", "admin-1")).rejects.toMatchObject({ code: "region_not_found" });
  });

  it("bestaande regio: delegeert naar recalculateStartRatings", async () => {
    mockPrisma.region.findUnique.mockResolvedValueOnce({ id: "r1" });
    await recalculateRegionStartRatings("r1", "admin-1");
    expect(mockRecalculate).toHaveBeenCalledWith({ regionId: "r1" }, "admin-1");
  });
});
