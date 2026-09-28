import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";
import { finalizeMatch } from "@/server/services/matchService";

export class DisputeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

async function isDuoMember(duoId: string, userId: string): Promise<boolean> {
  const membership = await prisma.duoMembership.findFirst({
    where: { duoId, userId, leftAt: null },
  });
  return membership !== null;
}

export async function openMatchScoreDispute(
  matchId: string,
  actingUserId: string,
  reason: string,
): Promise<{ id: string }> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    throw new DisputeError("Match niet gevonden.", "match_not_found", 404);
  }
  if (match.status !== "DISPUTED") {
    throw new DisputeError(
      "Er kan alleen een dispute geopend worden voor een betwiste match.",
      "match_not_disputed",
      400,
    );
  }

  const challenge = await prisma.challenge.findUniqueOrThrow({ where: { id: match.challengeId } });
  const [isChallenger, isChallenged] = await Promise.all([
    isDuoMember(challenge.challengerDuoId, actingUserId),
    isDuoMember(challenge.challengedDuoId, actingUserId),
  ]);
  if (!isChallenger && !isChallenged) {
    throw new DisputeError("Je bent geen lid van een van beide betrokken duo's.", "not_a_member", 403);
  }

  const existing = await prisma.dispute.findUnique({ where: { matchId } });
  if (existing) {
    throw new DisputeError("Er is al een dispute geopend voor deze match.", "dispute_already_exists", 400);
  }

  const dispute = await prisma.dispute.create({
    data: { matchId, subject: "MATCH_SCORE", raisedBy: actingUserId, reason },
  });
  return { id: dispute.id };
}

export async function openForfeitDispute(
  challengeId: string,
  actingUserId: string,
  reason: string,
): Promise<{ id: string }> {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) {
    throw new DisputeError("Challenge niet gevonden.", "challenge_not_found", 404);
  }
  if (challenge.status !== "UNPLAYED_TIMEOUT") {
    throw new DisputeError(
      "Er kan alleen een forfeit-dispute geopend worden voor een challenge met status unplayed_timeout.",
      "challenge_not_unplayed_timeout",
      400,
    );
  }

  const windowDays = await getConfigNumber("forfeit_dispute_window_days");
  const timeoutAt = challenge.respondedAt; // gezet door expireOneUnplayedChallenge (Sprint 3)
  if (timeoutAt) {
    const windowEndsAt = new Date(timeoutAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
    if (windowEndsAt < new Date()) {
      throw new DisputeError(
        "De termijn om een forfeit-dispute te openen is verstreken.",
        "dispute_window_passed",
        400,
      );
    }
  }

  const [isChallenger, isChallenged] = await Promise.all([
    isDuoMember(challenge.challengerDuoId, actingUserId),
    isDuoMember(challenge.challengedDuoId, actingUserId),
  ]);
  if (!isChallenger && !isChallenged) {
    throw new DisputeError("Je bent geen lid van een van beide betrokken duo's.", "not_a_member", 403);
  }

  const existing = await prisma.dispute.findUnique({ where: { challengeId } });
  if (existing) {
    throw new DisputeError(
      "Er is al een dispute geopend voor deze challenge.",
      "dispute_already_exists",
      400,
    );
  }

  const dispute = await prisma.dispute.create({
    data: { challengeId, subject: "FORFEIT", raisedBy: actingUserId, reason },
  });
  return { id: dispute.id };
}

export async function listOpenDisputes() {
  return prisma.dispute.findMany({
    where: { status: "OPEN" },
    include: {
      match: { include: { challenge: { include: { challengerDuo: true, challengedDuo: true } } } },
      challenge: { include: { challengerDuo: true, challengedDuo: true } },
      raisedByUser: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function assertOpenDispute(disputeId: string, subject: "MATCH_SCORE" | "FORFEIT") {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new DisputeError("Dispute niet gevonden.", "dispute_not_found", 404);
  }
  if (dispute.subject !== subject) {
    throw new DisputeError("Dispute-type komt niet overeen met dit endpoint.", "wrong_dispute_subject", 400);
  }
  if (dispute.status !== "OPEN") {
    throw new DisputeError("Deze dispute is al afgehandeld.", "dispute_not_open", 400);
  }
  return dispute;
}

async function logDisputeResolution(
  disputeId: string,
  adminUserId: string,
  payload: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      entityType: "dispute",
      entityId: disputeId,
      action: "dispute_resolved",
      performedBy: adminUserId,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

export async function resolveMatchScoreDispute(
  disputeId: string,
  adminUserId: string,
  resolution: "upheld" | "overturned",
  notes?: string,
): Promise<void> {
  const dispute = await assertOpenDispute(disputeId, "MATCH_SCORE");
  const matchId = dispute.matchId!;

  if (resolution === "overturned") {
    await overturnMatchScoreDispute(disputeId, matchId, adminUserId, notes);
    return;
  }

  // Zelfde ELO-verwerking als een normale bevestiging (US-F4), nu
  // vanuit status DISPUTED i.p.v. AWAITING_CONFIRMATION.
  await finalizeMatch(matchId, {
    confirmedBy: null,
    isAutoConfirm: false,
    fromStatuses: ["DISPUTED"],
  });

  await prisma.dispute.update({
    where: { id: disputeId },
    data: { status: "RESOLVED_UPHELD", resolvedBy: adminUserId, resolvedAt: new Date() },
  });

  await logDisputeResolution(disputeId, adminUserId, {
    subject: "match_score",
    resolution,
    matchId,
    notes,
  });
}

/**
 * `resolved_overturned` op een match-score-dispute (post-v1, akkoord PO
 * 2026-09-28): de match wordt `voided` en de challenge blijft `accepted`,
 * zodat de duo's opnieuw kunnen spelen en een NIEUWE score kunnen indienen
 * (submitScore staat een nieuwe match toe zodra alle eerdere matches voided
 * zijn). De speeltermijn herstart: nieuwe match_deadline = nu +
 * challenge_match_deadline_days, maar nooit korter dan de oorspronkelijke
 * deadline. Zonder herstart zou de (vaak al verstreken) oude deadline
 * ofwel elke nieuwe score blokkeren, ofwel direct een unplayed_timeout-
 * forfeit opleveren voor iets waar de duo's niets aan konden doen.
 *
 * Alles in één transactie met compare-and-swaps (dispute OPEN, match
 * DISPUTED, challenge ACCEPTED): een dubbele/gelijktijdige afhandeling
 * wordt geweigerd i.p.v. half uitgevoerd. Geen rating-impact (US-G3): op
 * een betwiste match is nog geen ELO-verwerking toegepast.
 */
async function overturnMatchScoreDispute(
  disputeId: string,
  matchId: string,
  adminUserId: string,
  notes?: string,
): Promise<void> {
  const matchDeadlineDays = await getConfigNumber("challenge_match_deadline_days");

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const disputeGuard = await tx.dispute.updateMany({
      where: { id: disputeId, status: "OPEN" },
      data: { status: "RESOLVED_OVERTURNED", resolvedBy: adminUserId, resolvedAt: now },
    });
    if (disputeGuard.count === 0) {
      throw new DisputeError("Deze dispute is al afgehandeld.", "dispute_not_open", 400);
    }

    const matchGuard = await tx.match.updateMany({
      where: { id: matchId, status: "DISPUTED" },
      data: { status: "VOIDED" },
    });
    if (matchGuard.count === 0) {
      throw new DisputeError(
        "De match staat niet (meer) op betwist en kan niet ongeldig verklaard worden.",
        "match_not_disputed",
        409,
      );
    }

    const match = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
    const challenge = await tx.challenge.findUniqueOrThrow({ where: { id: match.challengeId } });
    const restartedDeadline = new Date(now.getTime() + matchDeadlineDays * 24 * 60 * 60 * 1000);
    const newMatchDeadline =
      challenge.matchDeadline && challenge.matchDeadline > restartedDeadline
        ? challenge.matchDeadline
        : restartedDeadline;

    const challengeGuard = await tx.challenge.updateMany({
      where: { id: challenge.id, status: "ACCEPTED" },
      data: { matchDeadline: newMatchDeadline },
    });
    if (challengeGuard.count === 0) {
      throw new DisputeError(
        "De challenge staat niet meer op geaccepteerd; opnieuw spelen is niet mogelijk.",
        "challenge_not_accepted",
        409,
      );
    }

    await tx.auditLog.create({
      data: {
        entityType: "dispute",
        entityId: disputeId,
        action: "dispute_resolved",
        performedBy: adminUserId,
        payload: {
          subject: "match_score",
          resolution: "overturned",
          matchId,
          challengeId: challenge.id,
          replayAllowed: true,
          newMatchDeadline: newMatchDeadline.toISOString(),
          notes,
        } as Prisma.InputJsonValue,
      },
    });
  });
}

export async function resolveForfeitDispute(
  disputeId: string,
  adminUserId: string,
  resolution: "upheld" | "overturned",
  atFaultDuoId?: string,
  notes?: string,
): Promise<void> {
  const dispute = await assertOpenDispute(disputeId, "FORFEIT");
  const challengeId = dispute.challengeId!;
  const challenge = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });

  if (resolution === "overturned") {
    if (atFaultDuoId !== challenge.challengerDuoId && atFaultDuoId !== challenge.challengedDuoId) {
      throw new DisputeError(
        "atFaultDuoId moet één van beide betrokken duo's zijn.",
        "invalid_at_fault_duo",
        400,
      );
    }
    const innocentDuoId =
      atFaultDuoId === challenge.challengerDuoId ? challenge.challengedDuoId : challenge.challengerDuoId;
    const penalty = await getConfigNumber("forfeit_rating_penalty");

    await prisma.$transaction(async (tx) => {
      const innocentDuo = await tx.duo.findUniqueOrThrow({ where: { id: innocentDuoId } });
      const correctedRating = innocentDuo.currentRating + penalty; // penalty ongedaan maken

      await tx.duo.update({ where: { id: innocentDuoId }, data: { currentRating: correctedRating } });
      // Nieuw, gekoppeld correctie-record — het originele forfeit-record
      // (is_forfeit=true) blijft ongewijzigd staan (auditability, US-G3).
      await tx.ratingHistory.create({
        data: {
          duoId: innocentDuoId,
          challengeId,
          ratingBefore: innocentDuo.currentRating,
          ratingAfter: correctedRating,
          isForfeit: true,
        },
      });
    });
  }
  // Bij 'upheld' blijft de bestaande penalty bij beide duo's ongewijzigd staan.

  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: resolution === "upheld" ? "RESOLVED_UPHELD" : "RESOLVED_OVERTURNED",
      resolvedBy: adminUserId,
      resolvedAt: new Date(),
    },
  });

  await logDisputeResolution(disputeId, adminUserId, {
    subject: "forfeit",
    resolution,
    challengeId,
    atFaultDuoId: resolution === "overturned" ? atFaultDuoId : undefined,
    notes,
  });
}
