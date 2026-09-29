import { prisma } from "@/lib/prisma";
import { getTier, applyForfeitPenalty } from "@/lib/elo";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";
import { notifyChallengeReceived, notifySafely } from "@/server/services/notificationService";

export class ChallengeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

const ACTIVE_STATUSES = ["PENDING", "ACCEPTED"] as const;

export async function assertDuoMember(duoId: string, userId: string): Promise<void> {
  const membership = await prisma.duoMembership.findFirst({
    where: { duoId, userId, leftAt: null },
  });
  if (!membership) {
    throw new ChallengeError("Je bent geen lid van dit duo.", "not_a_member", 403);
  }
}

async function hasActiveChallenge(duoId: string): Promise<boolean> {
  const existing = await prisma.challenge.findFirst({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      OR: [{ challengerDuoId: duoId }, { challengedDuoId: duoId }],
    },
  });
  return existing !== null;
}

/**
 * Cooldown na een forfeit-penalty wordt afgeleid uit RatingHistory (net
 * als de duo-dissolution-cooldown in duoService) — geen aparte
 * "cooldown_until"-kolom nodig.
 */
async function isDuoInForfeitCooldown(duoId: string): Promise<boolean> {
  const cooldownDays = await getConfigNumber("forfeit_cooldown_days");
  const mostRecentForfeit = await prisma.ratingHistory.findFirst({
    where: { duoId, isForfeit: true },
    orderBy: { createdAt: "desc" },
  });
  if (!mostRecentForfeit) return false;
  const cooldownEndsAt = new Date(
    mostRecentForfeit.createdAt.getTime() + cooldownDays * 24 * 60 * 60 * 1000,
  );
  return cooldownEndsAt > new Date();
}

export async function proposeChallenge(
  challengerDuoId: string,
  challengedDuoId: string,
  actingUserId: string,
): Promise<{ id: string }> {
  await assertDuoMember(challengerDuoId, actingUserId);

  if (challengerDuoId === challengedDuoId) {
    throw new ChallengeError(
      "Een duo kan zichzelf niet uitdagen.",
      "cannot_challenge_self",
      400,
    );
  }

  const [challenger, challenged] = await Promise.all([
    prisma.duo.findUnique({ where: { id: challengerDuoId } }),
    prisma.duo.findUnique({ where: { id: challengedDuoId } }),
  ]);
  if (!challenger || !challenger.isActive) {
    throw new ChallengeError("Uitdagend duo niet gevonden of niet actief.", "duo_not_found", 404);
  }
  if (!challenged || !challenged.isActive) {
    throw new ChallengeError("Uitgedaagd duo niet gevonden of niet actief.", "duo_not_found", 404);
  }

  // Uitdagen is bedoeld voor duo's die daadwerkelijk tegen elkaar kunnen
  // spelen — zelfde regio (fysiek relevant) én zelfde rating-tier (FR-4.2).
  if (challenger.regionId !== challenged.regionId) {
    throw new ChallengeError(
      "Je kunt alleen duo's binnen je eigen regio uitdagen.",
      "different_region",
      400,
    );
  }

  const tierSize = await getConfigNumber("rating_tier_size");
  if (getTier(challenger.currentRating, tierSize) !== getTier(challenged.currentRating, tierSize)) {
    throw new ChallengeError(
      "Je kunt alleen duo's binnen jouw rating-tier uitdagen.",
      "different_tier",
      400,
    );
  }

  if (await hasActiveChallenge(challengerDuoId)) {
    throw new ChallengeError(
      "Jouw duo heeft al een actieve challenge (als uitdager of uitgedaagde).",
      "challenger_has_active_challenge",
      400,
    );
  }
  if (await hasActiveChallenge(challengedDuoId)) {
    throw new ChallengeError(
      "Dit duo heeft al een actieve challenge (als uitdager of uitgedaagde).",
      "challenged_has_active_challenge",
      400,
    );
  }

  if (await isDuoInForfeitCooldown(challengerDuoId)) {
    throw new ChallengeError(
      "Jouw duo zit nog in de cooldown na een eerdere forfeit-penalty.",
      "challenger_in_cooldown",
      400,
    );
  }
  if (await isDuoInForfeitCooldown(challengedDuoId)) {
    throw new ChallengeError(
      "Dit duo zit nog in de cooldown na een eerdere forfeit-penalty.",
      "challenged_in_cooldown",
      400,
    );
  }

  const responseDeadlineDays = await getConfigNumber("challenge_response_deadline_days");
  const challenge = await prisma.challenge.create({
    data: {
      challengerDuoId,
      challengedDuoId,
      responseDeadline: new Date(Date.now() + responseDeadlineDays * 24 * 60 * 60 * 1000),
    },
  });

  // Ná de commit; een mislukte mail breekt het uitdagen nooit.
  await notifySafely("nieuwe uitdaging", () => notifyChallengeReceived(challenge.id));
  return { id: challenge.id };
}

export async function respondToChallenge(
  challengeId: string,
  actingUserId: string,
  decision: "accept" | "decline",
): Promise<void> {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) {
    throw new ChallengeError("Challenge niet gevonden.", "challenge_not_found", 404);
  }

  await assertDuoMember(challenge.challengedDuoId, actingUserId);

  if (challenge.status !== "PENDING") {
    throw new ChallengeError(
      "Deze challenge is niet (meer) beschikbaar om op te reageren.",
      "challenge_not_pending",
      400,
    );
  }
  if (challenge.responseDeadline < new Date()) {
    throw new ChallengeError(
      "De reactietermijn voor deze challenge is al verstreken.",
      "response_deadline_passed",
      400,
    );
  }

  if (decision === "decline") {
    await prisma.challenge.update({
      where: { id: challengeId },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    return;
  }

  const matchDeadlineDays = await getConfigNumber("challenge_match_deadline_days");
  const now = new Date();
  await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      status: "ACCEPTED",
      respondedAt: now,
      acceptedAt: now,
      matchDeadline: new Date(now.getTime() + matchDeadlineDays * 24 * 60 * 60 * 1000),
    },
  });
}

export type ExpireResult = { challengeId: string; challengedDuoId: string } | null;

/**
 * Verwerkt precies één verlopen challenge, idempotent: de
 * `updateMany`-guard (status nog PENDING) fungeert als compare-and-swap,
 * zodat een dubbele/gelijktijdige aanroep de penalty niet dubbel toepast.
 */
async function expireOneChallenge(challengeId: string): Promise<ExpireResult> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.challenge.updateMany({
      where: { id: challengeId, status: "PENDING" },
      data: { status: "EXPIRED", respondedAt: new Date() },
    });
    if (updated.count === 0) {
      return null; // al verwerkt door een eerdere/gelijktijdige run
    }

    const challenge = await tx.challenge.findUniqueOrThrow({ where: { id: challengeId } });
    const duo = await tx.duo.findUniqueOrThrow({ where: { id: challenge.challengedDuoId } });
    const penalty = await getConfigNumber("forfeit_rating_penalty");
    const ratingBefore = duo.currentRating;
    const ratingAfter = applyForfeitPenalty(duo, penalty);

    await tx.duo.update({ where: { id: duo.id }, data: { currentRating: ratingAfter } });
    await tx.ratingHistory.create({
      data: {
        duoId: duo.id,
        challengeId: challenge.id,
        ratingBefore,
        ratingAfter,
        isForfeit: true,
      },
    });

    return { challengeId, challengedDuoId: duo.id };
  });
}

export async function expireOverdueChallenges(): Promise<ExpireResult[]> {
  const overdue = await prisma.challenge.findMany({
    where: { status: "PENDING", responseDeadline: { lt: new Date() } },
    select: { id: true },
  });

  const results: ExpireResult[] = [];
  for (const { id } of overdue) {
    results.push(await expireOneChallenge(id));
  }
  return results;
}

/**
 * Duo-velden die aan BEIDE partijen van een challenge getoond mogen
 * worden. Bewust geen volledige duo-rij: die bevat o.a. member_pair_key
 * (= de user-id's van de leden) en dissolution_requested_by_user_id, die
 * de tegenstander niet hoeft te zien (KNLTB-aanvullingen, privacy-audit).
 */
const PUBLIC_DUO_SELECT = {
  select: { id: true, name: true, regionId: true, currentRating: true, isActive: true, category: true },
} as const;

/**
 * Post-v1: een challenge kan meerdere matches hebben (replay na een
 * overturned dispute). De response behoudt het bestaande `match`-veld
 * (de actieve, niet-voided match, of null) zodat clients niet hoeven te
 * weten dat het intern 1:n is; `voidedMatches` bevat de ongeldig
 * verklaarde eerdere pogingen (nieuwste eerst) voor weergave/audit.
 *
 * KNLTB-aanvullingen: matches bevatten nu ook resultType/concedingSide/
 * playedScoreRaw, en `postponements` (nieuwste eerst) de uitstelverzoeken.
 */
export async function listChallengesForDuo(duoId: string) {
  const challenges = await prisma.challenge.findMany({
    where: { OR: [{ challengerDuoId: duoId }, { challengedDuoId: duoId }] },
    include: {
      challengerDuo: PUBLIC_DUO_SELECT,
      challengedDuo: PUBLIC_DUO_SELECT,
      matches: { include: { dispute: true }, orderBy: { submittedAt: "desc" } },
      dispute: true,
      postponements: {
        select: {
          id: true,
          requestedByDuoId: true,
          requestedDays: true,
          reason: true,
          status: true,
          previousMatchDeadline: true,
          newMatchDeadline: true,
          createdAt: true,
          respondedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return challenges.map(({ matches, ...challenge }) => ({
    ...challenge,
    match: matches.find((m) => m.status !== "VOIDED") ?? null,
    voidedMatches: matches.filter((m) => m.status === "VOIDED"),
  }));
}
