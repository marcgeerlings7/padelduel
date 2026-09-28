import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $executeRaw: vi.fn(async () => 1),
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { listUsers, setUserRole, ADMIN_USER_LIST_LIMIT } = await import("@/server/services/userAdminService");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listUsers", () => {
  it("geeft gebruikers met het aantal actieve duo's terug, zonder wachtwoord-hash", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: "u1",
        email: "a@example.com",
        role: "ADMIN",
        isActive: true,
        createdAt: new Date(),
        _count: { memberships: 2 },
      },
    ]);

    const result = await listUsers();

    expect(result).toEqual([
      expect.objectContaining({ id: "u1", email: "a@example.com", role: "ADMIN", activeDuoCount: 2 }),
    ]);
    expect(result[0]).not.toHaveProperty("_count");
    const args = mockPrisma.user.findMany.mock.calls[0][0];
    expect(args.select).not.toHaveProperty("passwordHash");
    expect(args.take).toBe(ADMIN_USER_LIST_LIMIT);
    expect(args.where).toBeUndefined();
  });

  it("filtert case-insensitive op e-mailadres als er een zoekterm is", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([]);
    await listUsers("  User2 ");
    expect(mockPrisma.user.findMany.mock.calls[0][0].where).toEqual({
      email: { contains: "User2", mode: "insensitive" },
    });
  });
});

describe("setUserRole", () => {
  it("promoveert een actieve gebruiker, onder advisory lock, met audit-log", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u2", role: "USER", isActive: true });

    const result = await setUserRole("u2", "ADMIN", "admin-1");

    expect(result).toEqual({ changed: true, role: "ADMIN" });
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { role: "ADMIN" } });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        entityType: "app_user",
        entityId: "u2",
        action: "user_role_changed",
        performedBy: "admin-1",
        payload: { from: "USER", to: "ADMIN" },
      },
    });
  });

  it("weigert promotie van een niet-geactiveerd account", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u2", role: "USER", isActive: false });
    await expect(setUserRole("u2", "ADMIN", "admin-1")).rejects.toMatchObject({
      code: "user_not_active",
      httpStatus: 400,
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("degradeert een admin als er nog een andere actieve admin is", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u3", role: "ADMIN", isActive: true });
    mockPrisma.user.count.mockResolvedValueOnce(1);

    const result = await setUserRole("u3", "USER", "admin-1");

    expect(result).toEqual({ changed: true, role: "USER" });
    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: { role: "ADMIN", isActive: true, id: { not: "u3" } },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payload: { from: "ADMIN", to: "USER" } }) }),
    );
  });

  it("weigert dat de laatste admin zichzelf degradeert", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "admin-1", role: "ADMIN", isActive: true });
    mockPrisma.user.count.mockResolvedValueOnce(0);

    await expect(setUserRole("admin-1", "USER", "admin-1")).rejects.toMatchObject({
      code: "last_admin",
      httpStatus: 409,
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("weigert ook het degraderen van de laatste actieve admin door een (inmiddels inactieve) andere admin", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u4", role: "ADMIN", isActive: true });
    mockPrisma.user.count.mockResolvedValueOnce(0);
    await expect(setUserRole("u4", "USER", "admin-1")).rejects.toMatchObject({ code: "last_admin" });
  });

  it("is een no-op (geen audit-rij) als de rol al klopt", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "u2", role: "ADMIN", isActive: true });

    await expect(setUserRole("u2", "ADMIN", "admin-1")).resolves.toEqual({ changed: false, role: "ADMIN" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("geeft 404 voor een onbekende gebruiker", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(setUserRole("onbekend", "ADMIN", "admin-1")).rejects.toMatchObject({
      code: "user_not_found",
      httpStatus: 404,
    });
  });
});
