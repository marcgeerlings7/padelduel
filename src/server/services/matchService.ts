import { Prisma } from "@prisma/client";
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

  const autoConfirmHours = await getConfigNumber("match_auto_confirm_hours");

  try {
    return await prisma.$transaction(async (tx) => {
      // Rij-lock op de challenge: serialiseert score-indiening met de
      // unplayed-timeout-job (die dezelfde lock neemt). Zo kan een challenge
      // nooit tegelijk een nieuwe match krijgen én op unplayed_timeout gaan.
      await lockChallengeRow(tx, challengeId);
      const locked = await tx.challenge.findUniqueOrThrow({ where: { id: challengeId } });
      if (locked.status !== "ACCEPTED") {
        throw new MatchError(
          "Score kan alleen ingediend worden voor een geaccepteerde challenge.",
          "challenge_not_accepted",
          400,
        );
      }
      if (locked.matchDeadline && locked.matchDeadline < new Date()) {
        throw new MatchError("De speeltermijn voor deze challenge is verstreken.", "match_deadline_passed", 400);
      }

      // Post-v1 (replay): een challenge mag meerdere matches hebben, maar
      // hooguit één die niet `voided` is. Alleen als alle eerdere matches
      // voided zijn (overturned dispute) mag er opnieuw een score komen.
      const activeMatch = await tx.match.findFirst({
        where: { challengeId, status: { not: "VOIDED" } },
        select: { id: true },
      });
      if (activeMatch) {
        throw new MatchError(
          "Er is al een score ingediend voor deze challenge.",
          "score_already_submitted",
          400,
        );
      }

      const match = await tx.match.create({
        data: {
          challengeId,
          scoreRaw: serializeScore(sets),
          submittedBy: actingUserId,
          autoConfirmDeadline: new Date(Date.now() + autoConfirmHours * 60 * 60 * 1000),
          idempotencyKey,
        },
      });
      return { id: match.id };
    });
  } catch (err) {
    // Vangnet voor een race tussen twee gelijktijdige submits: de unieke
    // index op idempotency_key of de partial unique index "hooguit één
    // niet-voided match per challenge" slaat aan.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const sameKey = await prisma.match.findUnique({ where: { idempotencyKey } });
      if (sameKey && sameKey.challengeId === challengeId) {
        return { id: sameKey.id };
      }
      throw new MatchError(
        "Er is al een score ingediend voor deze challenge.",
        "score_already_submitted",
        400,
      );
    }
    throw err;
  }
}

type TxClient = Prisma.TransactionClient;

/**
 * `SELECT ... FOR UPDATE` op de challenge-rij. Gebruikt door zowel
 * submitScore als expireOneUnplayedChallenge, zodat die twee elkaar
 * uitsluiten (zie ELO_Algoritme.md §5: transactioneel en idempotent).
 */
async function lockChallengeRow(tx: TxClient, challengeId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "challenge" WHERE id = ${challengeId}::uuid FOR UPDATE`;
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
 * status IN fromStatuses), analoog aan challengeService.
 *
 * Ook hergebruikt door disputeService bij een `resolved_upheld`
 * match-score-dispute (Sprint 4, US-G3) — daar is de match-status
 * DISPUTED i.p.v. AWAITING_CONFIRMATION, vandaar de configureerbare
 * `fromStatuses`.
 */
export async function finalizeMatch(
  matchId: string,
  options: {
    confirmedBy: string | null;
    isAutoConfirm: boolean;
    fromStatuses?: Array<"AWAITING_CONFIRMATION" | "DISPUTED">;
  },
): Promise<FinalizeResult> {
  const fromStatuses = options.fromStatuses ?? ["AWAITING_CONFIRMATION"];
  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  if (!fromStatuses.includes(match.status as "AWAITING_CONFIRMATION" | "DISPUTED")) {
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
      where: { id: matchId, status: { in: fromStatuses } },
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
 *
 * Post-v1: neemt eerst dezelfde rij-lock als submitScore en controleert
 * daarna (met een verse snapshot) opnieuw of er geen niet-voided match is
 * en of de — mogelijk door een overturned dispute verlengde — deadline nog
 * steeds verstreken is. Zo kan een net ingediende (replay-)score of een
 * net verlengde termijn nooit alsnog tot een forfeit leiden.
 */
async function expireOneUnplayedChallenge(challengeId: string): Promise<UnplayedTimeoutResult> {
  return prisma.$transaction(async (tx) => {
    await lockChallengeRow(tx, challengeId);
    const activeMatchCount = await tx.match.count({
      where: { challengeId, status: { not: "VOIDED" } },
    });
    if (activeMatchCount > 0) {
      return null;
    }

    const guard = await tx.challenge.updateMany({
      where: { id: challengeId, status: "ACCEPTED", matchDeadline: { lt: new Date() } },
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
  // niet-voided match (als er wél een match is — awaiting_confirmation of
  // disputed — is er al actie ondernomen en wordt NIET unplayed_timeout
  // gezet, US-F5). Post-v1: een challenge met uitsluitend voided matches
  // (overturned dispute) telt als "nog niet gespeeld"; de speeltermijn is
  // bij het overturnen opnieuw gestart (zie disputeService).
  const overdue = await prisma.challenge.findMany({
    where: {
      status: "ACCEPTED",
      matchDeadline: { lt: new Date() },
      matches: { none: { status: { not: "VOIDED" } } },
    },
    select: { id: true },
  });

  const results: UnplayedTimeoutResult[] = [];
  for (const { id } of overdue) {
    results.push(await expireOneUnplayedChallenge(id));
  }
  return results;
}
