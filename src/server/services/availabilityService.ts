import { prisma } from "@/lib/prisma";

export class AvailabilityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

async function assertDuoMember(duoId: string, userId: string): Promise<void> {
  const membership = await prisma.duoMembership.findFirst({
    where: { duoId, userId, leftAt: null },
  });
  if (!membership) {
    throw new AvailabilityError("Je bent geen lid van dit duo.", "not_a_member", 403);
  }
}

/** "HH:MM" -> Date met een vaste datumcomponent, voor de @db.Time-kolom. */
function timeStringToDate(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

function dateToTimeString(date: Date): string {
  return date.toISOString().slice(11, 16);
}

export type AvailabilityInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  recurring: boolean;
};

function serialize(block: {
  id: string;
  duoId: string;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
  recurring: boolean;
}) {
  return {
    id: block.id,
    duoId: block.duoId,
    dayOfWeek: block.dayOfWeek,
    startTime: dateToTimeString(block.startTime),
    endTime: dateToTimeString(block.endTime),
    recurring: block.recurring,
  };
}

export async function listAvailability(duoId: string, actingUserId: string) {
  await assertDuoMember(duoId, actingUserId);
  const blocks = await prisma.duoAvailability.findMany({
    where: { duoId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return blocks.map(serialize);
}

export async function addAvailability(
  duoId: string,
  actingUserId: string,
  input: AvailabilityInput,
) {
  await assertDuoMember(duoId, actingUserId);
  const block = await prisma.duoAvailability.create({
    data: {
      duoId,
      dayOfWeek: input.dayOfWeek,
      startTime: timeStringToDate(input.startTime),
      endTime: timeStringToDate(input.endTime),
      recurring: input.recurring,
    },
  });
  return serialize(block);
}

async function findOwnedBlock(availabilityId: string, actingUserId: string) {
  const block = await prisma.duoAvailability.findUnique({ where: { id: availabilityId } });
  if (!block) {
    throw new AvailabilityError("Beschikbaarheidsblok niet gevonden.", "not_found", 404);
  }
  await assertDuoMember(block.duoId, actingUserId);
  return block;
}

export async function updateAvailability(
  availabilityId: string,
  actingUserId: string,
  input: AvailabilityInput,
) {
  await findOwnedBlock(availabilityId, actingUserId);
  const block = await prisma.duoAvailability.update({
    where: { id: availabilityId },
    data: {
      dayOfWeek: input.dayOfWeek,
      startTime: timeStringToDate(input.startTime),
      endTime: timeStringToDate(input.endTime),
      recurring: input.recurring,
    },
  });
  return serialize(block);
}

export async function deleteAvailability(availabilityId: string, actingUserId: string): Promise<void> {
  await findOwnedBlock(availabilityId, actingUserId);
  await prisma.duoAvailability.delete({ where: { id: availabilityId } });
}
