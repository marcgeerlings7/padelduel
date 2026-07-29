import { prisma } from "@/lib/prisma";
import { applyMatchResult, applyForfeitPenalty } from "@/lib/elo";
import {
  parseScore,
  validateSets,
  determineWinner,
  serializeScore,
  SetScore,
  InvalidScoreError,
} from "@/lib/match/score";
import { getLadder } from "@/server/services/ladderService";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";

export class MatchError extends Error {
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

export async function submitScore(
  challengeId: string,
  actingUserId: string,
  sets: SetScore[],
  idempotencyKey: string,
): Promise<{ id: string }> {
  try {
    validateSets(sets);
  } catch (err) {
    if (err instanceof InvalidScoreError) {
      throw new MatchError(err.message, "invalid_score", 400);
    }
    throw err;
  }

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) {
    throw new MatchError("Challenge niet gevonden.", "challenge_not_found", 404);
  }
  if (challenge.status !== "ACCEPTED") {
    throw new MatchError(
      "Score kan alleen ingediend worden voor een geaccepteerde challenge.",
      "challenge_not_accepted",
      400,
    );
  }
  if (challenge.matchDeadline && challenge.matchDeadline < new Date()) {
    throw new MatchError("De speeltermijn voor deze challenge is verstreken.", "match_deadline_passed", 400);
  }

  const [isChallenger, isChallenged] = await Promise.all([
    isDuoMember(challenge.challengerDuoId, actingUserId),
    isDuoMember(challenge.challengedDuoId, actingUserId),
  ]);
  if (!isChallenger && !isChallenged) {
    throw new MatchError(
      "Je bent geen lid van een van beide betrokken duo's.",
      "not_a_member",
      403,
    );
  }

  // Idempotentie (FR-5.5/US-F1): een herhaalde submit met dezelfde key
  // resulteert niet in een tweede Match.
  const existingByKey = await prisma.match.findUnique({ where: { idempotencyKey } });
  if (existingByKey) {
    if (existingByKey.challengeId !== challengeId) {
      throw new MatchError(
        "Deze idempotency-key is al gebruikt voor een andere challenge.",
        "idempotency_key_reused",
        409,
      );
    }
    return { id: existingByKey.id };
  }

  const existingForChallenge = await prisma.match.findUnique({ where: { challengeId } });
  if (existingForChallenge) {
    throw new MatchError(
      "Er is al een score ingediend voor deze challenge.",
      "score_already_submitted",
      400,
    );
  }

  const autoConfirmHours = await getConfigNumber("match_auto_confirm_hours");
  const match = await prisma.match.create({
    data: {
      challengeId,
      scoreRaw: serializeScore(sets),
      submittedBy: actingUserId,
      autoConfirmDeadline: new Date(Date.now() + autoConfirmHours * 60 * 60 * 1000),
      idempotencyKey,
    },
  });

  return { id: match.id };
}

export async function respondToMatch(
  matchId: string,
  actingUserId: string,
  decision: "confirm" | "dispute",
): Promise<{ status: "completed" | "disputed" }> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    throw new MatchError("Match niet gevonden.", "match_not_found", 404);
  }
  if (match.status !== "AWAITING_CONFIRMATION") {
    throw new MatchError(
      "Deze match wacht niet (meer) op bevestiging.",
      "match_not_awaiting_confirmation",
      400,
    );
  }

  const challenge = await prisma.challenge.findUniqueOrThrow({ where: { id: match.challengeId } });
  const submitterIsChallenger = await isDuoMember(challenge.challengerDuoId, match.submittedBy);
  const submitterDuoId = submitterIsChallenger ? challenge.challengerDuoId : challenge.challengedDuoId;
  const otherDuoId =
    submitterDuoId === challenge.challengerDuoId ? challenge.challengedDuoId : challenge.challengerDuoId;

  const actingIsOtherDuoMember = await isDuoMember(otherDuoId, actingUserId);
  if (!actingIsOtherDuoMember) {
    const actingIsSubmitterDuoMember = await isDuoMember(submitterDuoId, actingUserId);
    if (actingIsSubmitterDuoMember) {
      throw new MatchError(
        "Je kunt de score van je eigen duo niet bevestigen of betwisten.",
        "cannot_respond_to_own_score",
        403,
      );
    }
    throw new MatchError("Je bent niet gemachtigd om op deze match te reageren.", "not_authorized", 403);
  }

  if (decision === "dispute") {
    await prisma.match.update({ where: { id: matchId }, data: { status: "DISPUTED" } });
    return { status: "disputed" };
  }

  await finalizeMatch(matchId, { confirmedBy: actingUserId, isAutoConfirm: false });
  return { status: "completed" };
}

export type FinalizeResult = { alreadyProcessed: boolean };

/**
 * Gedeelde ELO-verwerking (US-F4), gebruikt door zowel handmatige
 * bevestiging als de auto-confirm-achtergrondjob (US-F3: "triggert
 * vervolgens dezelfde ELO-verwerking als een handmatige bevestiging").
 * Idempotent via een compare-and-swap update binnen de transactie (WHERE
 * status = AWAITING_CONFIRMATION), analoog aan challengeService.
 */
async function finalizeMatch(
  matchId: string,
  options: { confirmedBy: string | null; isAutoConfirm: boolean },
): Promise<FinalizeResult> {
  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  if (match.status !== "AWAITING_CONFIRMATION") {
    return { alreadyProcessed: true };
  }

  const challenge = await prisma.challenge.findUniqueOrThrow({ where: { id: match.challengeId } });
  const sets = parseScore(match.scoreRaw);
  const winnerSide = determineWinner(sets);
  const winnerDuoId = winnerSide === "challenger" ? challenge.challengerDuoId : challenge.challengedDuoId;
  const loserDuoId = winnerSide === "challenger" ? challenge.challengedDuoId : challenge.challengerDuoId;

  const [winnerDuo, loserDuo] = await Promise.all([
    prisma.duo.findUniqueOrThrow({ where: { id: winnerDuoId } }),
    prisma.duo.findUniqueOrThrow({ where: { id: loserDuoId } }),
  ]);

  const ladder = await getLadder(winnerDuo.regionId);
  const ladderSize = ladder.length || 1;
  const winnerPercentile = (ladder.find((e) => e.id === winnerDuoId)?.position ?? ladderSize) / ladderSize;
  const loserPercentile = (ladder.find((e) => e.id === loserDuoId)?.position ?? ladderSize) / ladderSize;

  const repeatedWindowDays = await getConfigNumber("repeated_opponent_window_days");
  const windowStart = new Date(Date.now() - repeatedWindowDays * 24 * 60 * 60 * 1000);
  const priorMatch = await prisma.match.findFirst({
    where: {
      id: { not: matchId },
      status: "COMPLETED",
      confirmedAt: { gte: windowStart },
      challenge: {
        OR: [
          { challengerDuoId: winnerDuoId, challengedDuoId: loserDuoId },
          { challengerDuoId: loserDuoId, challengedDuoId: winnerDuoId },
        ],
      },
    },
  });

  const eloResult = applyMatchResult({
    winner: { id: winnerDuo.id, currentRating: winnerDuo.currentRating, matchesPlayed: winnerDuo.matchesPlayed },
    loser: { id: loserDuo.id, currentRating: loserDuo.currentRating, matchesPlayed: loserDuo.matchesPlayed },
    winnerPercentile,
    loserPercentile,
    isRepeatedOpponentWithinWindow: priorMatch !== null,
  });

  return prisma.$transaction(async (tx) => {
    const guard = await tx.match.updateMany({
      where: { id: matchId, status: "AWAITING_CONFIRMATION" },
      data: { status: "COMPLETED", confirmedBy: options.confirmedBy, confirmedAt: new Date() },
    });
    if (guard.count === 0) {
      return { alreadyProcessed: true };
    }

    await tx.challenge.update({ where: { id: challenge.id }, data: { status: "COMPLETED" } });
    await tx.duo.update({
      where: { id: winnerDuo.id },
      data: { currentRating: eloResult.winnerNewRating, matchesPlayed: { increment: 1 } },
    });
    await tx.duo.update({
      where: { id: loserDuo.id },
      data: { currentRating: eloResult.loserNewRating, matchesPlayed: { increment: 1 } },
    });
    await tx.ratingHistory.create({
      data: {
        duoId: winnerDuo.id,
        matchId,
        ratingBefore: winnerDuo.currentRating,
        ratingAfter: eloResult.winnerNewRating,
        kFactor: Math.round(eloResult.winnerKFactor),
        isForfeit: false,
      },
    });
    await tx.ratingHistory.create({
      data: {
        duoId: loserDuo.id,
        matchId,
        ratingBefore: loserDuo.currentRating,
        ratingAfter: eloResult.loserNewRating,
        kFactor: Math.round(eloResult.loserKFactor),
        isForfeit: false,
      },
    });

    if (options.isAutoConfirm) {
      await tx.auditLog.create({
        data: {
          entityType: "match",
          entityId: matchId,
          action: "match_auto_confirmed",
          performedBy: null,
          payload: { reason: "auto_confirm_deadline_passed" },
        },
      });
    }

    return { alreadyProcessed: false };
  });
}

export async function autoConfirmOverdueMatches(): Promise<
  Array<{ matchId: string } & FinalizeResult>
> {
  const overdue = await prisma.match.findMany({
    where: { status: "AWAITING_CONFIRMATION", autoConfirmDeadline: { lt: new Date() } },
    select: { id: true },
  });

  const results: Array<{ matchId: string } & FinalizeResult> = [];
  for (const { id } of overdue) {
    const result = await finalizeMatch(id, { confirmedBy: null, isAutoConfirm: true });
    results.push({ matchId: id, ...result });
  }
  return results;
}

export type UnplayedTimeoutResult = { challengeId: string; challengerDuoId: string; challengedDuoId: string } | null;

/**
 * Idempotent via compare-and-swap (WHERE status = ACCEPTED), analoog aan
 * de challenge-expiratiejob uit Sprint 2.
 */
async function expireOneUnplayedChallenge(challengeId: string): Promise<UnplayedTimeoutResult> {
  return prisma.$transaction(async (tx) => {
    const guard = await tx.challenge.updateMany({
      where: { id: challengeId, status: "ACCEPTED" },
      data: { status: "UNPLAYED_TIMEOUT", respondedAt: new Date() },
    });
    if (guard.count === 0) {
      return null;
    }

    const challenge = await tx.challenge.findUniqueOrThrow({ where: { id: challengeId } });
    const penalty = await getConfigNumber("forfeit_rating_penalty");
    const [challengerDuo, challengedDuo] = await Promise.all([
      tx.duo.findUniqueOrThrow({ where: { id: challenge.challengerDuoId } }),
      tx.duo.findUniqueOrThrow({ where: { id: challenge.challengedDuoId } }),
    ]);

    const challengerNewRating = applyForfeitPenalty(challengerDuo, penalty);
    const challengedNewRating = applyForfeitPenalty(challengedDuo, penalty);

    await tx.duo.update({ where: { id: challengerDuo.id }, data: { currentRating: challengerNewRating } });
    await tx.duo.update({ where: { id: challengedDuo.id }, data: { currentRating: challengedNewRating } });
    await tx.ratingHistory.create({
      data: {
        duoId: challengerDuo.id,
        challengeId,
        ratingBefore: challengerDuo.currentRating,
        ratingAfter: challengerNewRating,
        isForfeit: true,
      },
    });
    await tx.ratingHistory.create({
      data: {
        duoId: challengedDuo.id,
        challengeId,
        ratingBefore: challengedDuo.currentRating,
        ratingAfter: challengedNewRating,
        isForfeit: true,
      },
    });

    return {
      challengeId,
      challengerDuoId: challengerDuo.id,
      challengedDuoId: challengedDuo.id,
    };
  });
}

export async function expireUnplayedChallenges(): Promise<UnplayedTimeoutResult[]> {
  // Challenges met status ACCEPTED, verstreken match_deadline, én zonder
  // gekoppelde match (ongeacht status: als er wél een match is —
  // awaiting_confirmation of disputed — is er al actie ondernomen en
  // wordt NIET unplayed_timeout gezet, US-F5).
  const overdue = await prisma.challenge.findMany({
    where: { status: "ACCEPTED", matchDeadline: { lt: new Date() }, match: null },
    select: { id: true },
  });

  const results: UnplayedTimeoutResult[] = [];
  for (const { id } of overdue) {
    results.push(await expireOneUnplayedChallenge(id));
  }
  return results;
}
