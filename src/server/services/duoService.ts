import { prisma } from "@/lib/prisma";
import { buildPairKey } from "@/lib/duo/pairKey";
import { generateDuoName } from "@/lib/duo/nameGenerator";
import { getTier } from "@/lib/elo";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";

export class DuoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

async function activeMembershipCount(userId: string): Promise<number> {
  return prisma.duoMembership.count({ where: { userId, leftAt: null } });
}

async function assertUnderMaxActiveDuos(userId: string, errorMessage: string): Promise<void> {
  const [max, current] = await Promise.all([
    getConfigNumber("max_active_duos_per_user"),
    activeMembershipCount(userId),
  ]);
  if (current >= max) {
    throw new DuoError(errorMessage, "max_active_duos_reached", 400);
  }
}

export async function proposeDuo(
  proposerUserId: string,
  params: { duoName?: string; regionSlug: string; invitedEmail: string },
): Promise<{ id: string }> {
  const duoName = params.duoName?.trim() || generateDuoName();
  const region = await prisma.region.findUnique({ where: { slug: params.regionSlug } });
  if (!region) {
    throw new DuoError("Regio niet gevonden.", "region_not_found", 404);
  }

  const invitedUser = await prisma.user.findUnique({ where: { email: params.invitedEmail } });
  if (!invitedUser) {
    throw new DuoError("Gebruiker met dit e-mailadres niet gevonden.", "user_not_found", 404);
  }
  if (invitedUser.id === proposerUserId) {
    throw new DuoError("Je kunt jezelf niet uitnodigen.", "cannot_invite_self", 400);
  }
  if (!invitedUser.isActive) {
    throw new DuoError(
      "Deze gebruiker heeft zijn/haar account nog niet geactiveerd.",
      "invited_user_not_active",
      400,
    );
  }

  await assertUnderMaxActiveDuos(
    proposerUserId,
    "Je hebt het maximum aantal actieve duo's al bereikt.",
  );

  const pairKey = buildPairKey(proposerUserId, invitedUser.id);

  const existingActiveDuo = await prisma.duo.findFirst({
    where: { memberPairKey: pairKey, isActive: true },
  });
  if (existingActiveDuo) {
    throw new DuoError("Jullie hebben al een actief duo samen.", "duo_already_active", 400);
  }

  const cooldownDays = await getConfigNumber("duo_dissolution_cooldown_days");
  const mostRecentDissolved = await prisma.duo.findFirst({
    where: { memberPairKey: pairKey, dissolvedAt: { not: null } },
    orderBy: { dissolvedAt: "desc" },
  });
  if (mostRecentDissolved?.dissolvedAt) {
    const cooldownEndsAt = new Date(
      mostRecentDissolved.dissolvedAt.getTime() + cooldownDays * 24 * 60 * 60 * 1000,
    );
    if (cooldownEndsAt > new Date()) {
      const daysRemaining = Math.ceil((cooldownEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      throw new DuoError(
        `Jullie kunnen pas over ${daysRemaining} dag(en) weer samen een duo vormen (cooldown na ontbinding).`,
        "duo_dissolution_cooldown",
        400,
      );
    }
  }

  const existingPendingInvitation = await prisma.duoInvitation.findFirst({
    where: { invitationPairKey: pairKey, status: "PENDING" },
  });
  if (existingPendingInvitation) {
    throw new DuoError(
      "Er is al een openstaand voorstel tussen jullie.",
      "invitation_already_pending",
      400,
    );
  }

  const invitation = await prisma.duoInvitation.create({
    data: {
      duoName,
      regionId: region.id,
      proposedByUserId: proposerUserId,
      invitedUserId: invitedUser.id,
      invitationPairKey: pairKey,
    },
  });

  return { id: invitation.id };
}

export async function respondToInvitation(
  invitationId: string,
  respondingUserId: string,
  decision: "accept" | "decline",
): Promise<{ duoId?: string }> {
  const invitation = await prisma.duoInvitation.findUnique({ where: { id: invitationId } });
  if (!invitation) {
    throw new DuoError("Uitnodiging niet gevonden.", "invitation_not_found", 404);
  }
  if (invitation.status !== "PENDING") {
    throw new DuoError(
      "Deze uitnodiging is al beantwoord of niet meer geldig.",
      "invitation_not_pending",
      400,
    );
  }
  if (invitation.invitedUserId !== respondingUserId) {
    throw new DuoError(
      "Je bent niet gemachtigd om op deze uitnodiging te reageren.",
      "not_authorized",
      403,
    );
  }

  if (decision === "decline") {
    await prisma.duoInvitation.update({
      where: { id: invitationId },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    return {};
  }

  await assertUnderMaxActiveDuos(
    invitation.proposedByUserId,
    "De uitnodigende speler heeft het maximum aantal actieve duo's al bereikt.",
  );
  await assertUnderMaxActiveDuos(
    respondingUserId,
    "Je hebt het maximum aantal actieve duo's al bereikt.",
  );

  const existingActiveDuo = await prisma.duo.findFirst({
    where: { memberPairKey: invitation.invitationPairKey, isActive: true },
  });
  if (existingActiveDuo) {
    throw new DuoError("Jullie hebben al een actief duo samen.", "duo_already_active", 400);
  }

  try {
    const duo = await prisma.$transaction(async (tx) => {
      const createdDuo = await tx.duo.create({
        data: {
          name: invitation.duoName,
          regionId: invitation.regionId,
          memberPairKey: invitation.invitationPairKey,
          isActive: true,
        },
      });
      await tx.duoMembership.create({
        data: { userId: invitation.proposedByUserId, duoId: createdDuo.id },
      });
      await tx.duoMembership.create({
        data: { userId: invitation.invitedUserId, duoId: createdDuo.id },
      });
      await tx.duoInvitation.update({
        where: { id: invitationId },
        data: { status: "ACCEPTED", respondedAt: new Date(), resultingDuoId: createdDuo.id },
      });
      return createdDuo;
    });
    return { duoId: duo.id };
  } catch {
    throw new DuoError(
      "Kon het duo niet aanmaken (limiet bereikt of gelijktijdige wijziging). Probeer opnieuw.",
      "duo_creation_failed",
      409,
    );
  }
}

export async function dissolveDuo(
  duoId: string,
  actingUserId: string,
): Promise<{ status: "requested" | "dissolved" }> {
  const duo = await prisma.duo.findUnique({ where: { id: duoId } });
  if (!duo || !duo.isActive) {
    throw new DuoError("Duo niet gevonden of al ontbonden.", "duo_not_found", 404);
  }

  const membership = await prisma.duoMembership.findFirst({
    where: { duoId, userId: actingUserId, leftAt: null },
  });
  if (!membership) {
    throw new DuoError("Je bent geen lid van dit duo.", "not_a_member", 403);
  }

  if (!duo.dissolutionRequestedAt) {
    await prisma.duo.update({
      where: { id: duoId },
      data: { dissolutionRequestedAt: new Date(), dissolutionRequestedByUserId: actingUserId },
    });
    return { status: "requested" };
  }

  if (duo.dissolutionRequestedByUserId === actingUserId) {
    throw new DuoError(
      "Je hebt de ontbinding al aangevraagd; wacht op bevestiging van de andere speler.",
      "dissolution_already_requested_by_you",
      400,
    );
  }

  await prisma.$transaction([
    prisma.duo.update({
      where: { id: duoId },
      data: { isActive: false, dissolvedAt: new Date() },
    }),
    prisma.duoMembership.updateMany({
      where: { duoId, leftAt: null },
      data: { leftAt: new Date() },
    }),
  ]);

  return { status: "dissolved" };
}

export async function listMyDuos(userId: string) {
  const [duos, tierSize] = await Promise.all([
    prisma.duo.findMany({
      where: { isActive: true, memberships: { some: { userId, leftAt: null } } },
      include: { region: true },
      orderBy: { createdAt: "asc" },
    }),
    getConfigNumber("rating_tier_size"),
  ]);
  return duos.map((duo) => ({ ...duo, tier: getTier(duo.currentRating, tierSize) }));
}

export async function listMyInvitations(userId: string) {
  const [received, sent] = await Promise.all([
    prisma.duoInvitation.findMany({
      where: { invitedUserId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.duoInvitation.findMany({
      where: { proposedByUserId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { received, sent };
}
