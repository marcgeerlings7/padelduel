import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  duoMembership: { findFirst: vi.fn() },
  duoAvailability: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const {
  listAvailability,
  addAvailability,
  updateAvailability,
  deleteAvailability,
} = await import("@/server/services/availabilityService");

function block(overrides: Record<string, unknown> = {}) {
  return {
    id: "block-1",
    duoId: "duo-1",
    dayOfWeek: 1,
    startTime: new Date("1970-01-01T18:00:00.000Z"),
    endTime: new Date("1970-01-01T20:00:00.000Z"),
    recurring: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.duoMembership.findFirst.mockResolvedValue({ id: "membership-1" });
});

describe("listAvailability", () => {
  it("geeft geserialiseerde tijdsblokken terug (HH:MM)", async () => {
    mockPrisma.duoAvailability.findMany.mockResolvedValueOnce([block()]);
    const result = await listAvailability("duo-1", "user-1");
    expect(result).toEqual([
      { id: "block-1", duoId: "duo-1", dayOfWeek: 1, startTime: "18:00", endTime: "20:00", recurring: true },
    ]);
  });

  it("weigert een niet-lid", async () => {
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce(null);
    await expect(listAvailability("duo-1", "user-1")).rejects.toMatchObject({ code: "not_a_member" });
  });
});

describe("addAvailability", () => {
  it("slaat een nieuw blok op met correcte tijdconversie", async () => {
    mockPrisma.duoAvailability.create.mockResolvedValueOnce(block());
    const result = await addAvailability("duo-1", "user-1", {
      dayOfWeek: 1,
      startTime: "18:00",
      endTime: "20:00",
      recurring: true,
    });
    expect(result.startTime).toBe("18:00");
    expect(mockPrisma.duoAvailability.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          duoId: "duo-1",
          startTime: new Date("1970-01-01T18:00:00.000Z"),
          endTime: new Date("1970-01-01T20:00:00.000Z"),
        }),
      }),
    );
  });

  it("weigert een niet-lid", async () => {
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce(null);
    await expect(
      addAvailability("duo-1", "user-1", { dayOfWeek: 1, startTime: "18:00", endTime: "20:00", recurring: true }),
    ).rejects.toMatchObject({ code: "not_a_member" });
  });
});

describe("updateAvailability / deleteAvailability", () => {
  it("update: weigert een gebruiker die geen lid is van het duo achter het blok", async () => {
    mockPrisma.duoAvailability.findUnique.mockResolvedValueOnce(block());
    mockPrisma.duoMembership.findFirst.mockResolvedValueOnce(null);

    await expect(
      updateAvailability("block-1", "user-1", { dayOfWeek: 2, startTime: "10:00", endTime: "11:00", recurring: false }),
    ).rejects.toMatchObject({ code: "not_a_member" });
  });

  it("update: past een bestaand blok aan", async () => {
    mockPrisma.duoAvailability.findUnique.mockResolvedValueOnce(block());
    mockPrisma.duoAvailability.update.mockResolvedValueOnce(
      block({ dayOfWeek: 2, startTime: new Date("1970-01-01T10:00:00.000Z"), endTime: new Date("1970-01-01T11:00:00.000Z") }),
    );

    const result = await updateAvailability("block-1", "user-1", {
      dayOfWeek: 2,
      startTime: "10:00",
      endTime: "11:00",
      recurring: false,
    });
    expect(result.dayOfWeek).toBe(2);
  });

  it("delete: verwijdert een blok waar de gebruiker lid van is", async () => {
    mockPrisma.duoAvailability.findUnique.mockResolvedValueOnce(block());
    await deleteAvailability("block-1", "user-1");
    expect(mockPrisma.duoAvailability.delete).toHaveBeenCalledWith({ where: { id: "block-1" } });
  });

  it("delete: weigert een niet-bestaand blok", async () => {
    mockPrisma.duoAvailability.findUnique.mockResolvedValueOnce(null);
    await expect(deleteAvailability("block-x", "user-1")).rejects.toMatchObject({ code: "not_found" });
  });
});
