/**
 * Uitstel van de speeltermijn in onderling overleg (KNLTB-aanvullingen,
 * akkoord PO 2026-09-28). KNLTB kent geen eenzijdig uitstel: één duo vraagt
 * N dagen aan, het andere duo accepteert of weigert. Alleen een
 * geaccepteerd verzoek verschuift challenge.match_deadline.
 *
 * Regels:
 * - alleen voor een ACCEPTED challenge, vóór de match_deadline, zolang er
 *   geen (niet-voided) score is ingediend;
 * - 1 ≤ dagen ≤ platform_config.postponement_max_days;
 * - hooguit postponement_max_per_challenge GEACCEPTEERDE verzoeken per
 *   challenge (geweigerde/ingetrokken tellen niet mee);
 * - hooguit één openstaand verzoek tegelijk (partial unique index);
 * - de nieuwe deadline = de deadline op het moment van ACCEPTEREN + dagen.
 *
 * Concurrency: aanvragen en accepteren nemen dezelfde rij-lock op de
 * challenge als submitScore en de unplayed-timeout-job
 * (lockChallengeRow), en controleren daarna alles opnieuw. Status-
 * overgangen zijn compare-and-swaps (WHERE status = 'PENDING'), dus een
 * dubbele of gelijktijdige reactie wordt geweigerd i.p.v. dubbel verwerkt.
 */
import { Prisma, PostponementStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnswerPostponementInput, RequestPostponementInput } from "@/lib/postponement/validation";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";
import { lockChallengeRow } from "@/server/repositories/challengeLock";
import {
  notifyPostponementAnswered,
  notifyPostponementRequested,
  notifySafely,
} from "@/server/services/notificationService";

const DAY_MS = 24 * 60 * 60 * 1000;

export class PostponementError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

export type PostponementStatusName = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export type PostponementDto = {
  id: string;
  challengeId: string;
  requestedByDuoId: string;
  requestedByDuoName: string;
  requestedDays: number;
  reason: string | null;
  status: PostponementStatusName;
  /** Alleen bij pending: de huidige deadline + requestedDays (indicatief). */
  proposedMatchDeadline: string | null;
  /** Gezet bij accepted. */
  previousMatchDeadline: string | null;
  newMatchDeadline: string | null;
  createdAt: string;
  respondedAt: string | null;
};

export type PostponementOverview = {
  challengeId: string;
  challengeStatus: string;
  matchDeadline: string | null;
  maxDays: number;
  maxPerChallenge: number;
  acceptedCount: number;
  remaining: number;
  /** Mag de ingelogde gebruiker nu een nieuw verzoek indienen? */
  canRequest: boolean;
  /** Mag de ingelogde gebruiker het openstaande verzoek accepteren/weigeren? */
  canRespond: boolean;
  /** Mag de ingelogde gebruiker het openstaande verzoek intrekken? */
  canCancel: boolean;
  pending: PostponementDto | null;
  /** Alle verzoeken, nieuwste eerst (incl. pending). */
  history: PostponementDto[];
};

const STATUS_NAME: Record<PostponementStatus, PostponementStatusName> = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
};

type ChallengeRow = {
  id: string;
  status: string;
  challengerDuoId: string;
  challengedDuoId: string;
  matchDeadline: Date | null;
};

async function memberSides(challenge: ChallengeRow, userId: string) {
  const memberships = await prisma.duoMembership.findMany({
    where: { userId, leftAt: null, duoId: { in: [challenge.challengerDuoId, challenge.challengedDuoId] } },
    select: { duoId: true },
  });
  const duoIds = new Set(memberships.map((m) => m.duoId));
  return {
    isChallenger: duoIds.has(challenge.challengerDuoId),
    isChallenged: duoIds.has(challenge.challengedDuoId),
  };
}

function otherDuoId(challenge: ChallengeRow, duoId: string): string {
  return duoId === challenge.challengerDuoId ? challenge.challengedDuoId : challenge.challengerDuoId;
}

async function loadChallenge(challengeId: string): Promise<ChallengeRow> {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) {
    throw new PostponementError("Challenge niet gevonden.", "challenge_not_found", 404);
  }
  return challenge;
}

type TxClient = Prisma.TransactionClient;

/** Gedeelde checks, altijd ná de rij-lock met verse data. */
async function assertChallengeOpenForPostponement(tx: TxClient, challengeId: string, now: Date) {
  const challenge = await tx.challenge.findUniqueOrThrow({ where: { id: challengeId } });
  if (challenge.status !== "ACCEPTED" || !challenge.matchDeadline) {
    throw new PostponementError(
      "Uitstel kan alleen voor een geaccepteerde challenge.",
      "challenge_not_accepted",
      400,
    );
  }
  if (challenge.matchDeadline <= now) {
    throw new PostponementError("De speeltermijn is al verstreken.", "match_deadline_passed", 400);
  }
  const activeMatch = await tx.match.findFirst({
    where: { challengeId, status: { not: "VOIDED" } },
    select: { id: true },
  });
  if (activeMatch) {
    throw new PostponementError(
      "Er is al een score ingediend; uitstel is niet meer nodig.",
      "score_already_submitted",
      400,
    );
  }
  return { ...challenge, matchDeadline: challenge.matchDeadline };
}

async function assertUnderLimit(tx: TxClient, challengeId: string, maxPerChallenge: number) {
  const acceptedCount = await tx.challengePostponement.count({
    where: { challengeId, status: "ACCEPTED" },
  });
  if (acceptedCount >= maxPerChallenge) {
    throw new PostponementError(
      `Voor deze challenge is al het maximum van ${maxPerChallenge} keer uitstel gegeven.`,
      "postponement_limit_reached",
      400,
    );
  }
}

export async function requestPostponement(
  challengeId: string,
  actingUserId: string,
  input: RequestPostponementInput,
): Promise<PostponementDto> {
  const [maxDays, maxPerChallenge] = await Promise.all([
    getConfigNumber("postponement_max_days"),
    getConfigNumber("postponement_max_per_challenge"),
  ]);
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > maxDays) {
    throw new PostponementError(
      `Je kunt 1 tot en met ${maxDays} dag(en) uitstel vragen.`,
      "invalid_days",
      400,
    );
  }

  const challenge = await loadChallenge(challengeId);
  const { isChallenger, isChallenged } = await memberSides(challenge, actingUserId);
  if (!isChallenger && !isChallenged) {
    throw new PostponementError("Je bent geen lid van een van beide betrokken duo's.", "not_a_member", 403);
  }

  let requestingDuoId: string;
  if (input.duoId) {
    const allowed =
      (input.duoId === challenge.challengerDuoId && isChallenger) ||
      (input.duoId === challenge.challengedDuoId && isChallenged);
    if (!allowed) {
      throw new PostponementError("Je bent geen lid van dit duo.", "not_a_member", 403);
    }
    requestingDuoId = input.duoId;
  } else if (isChallenger && isChallenged) {
    throw new PostponementError(
      "Je bent lid van beide duo's; geef aan namens welk duo je uitstel vraagt (duoId).",
      "ambiguous_duo",
      400,
    );
  } else {
    requestingDuoId = isChallenger ? challenge.challengerDuoId : challenge.challengedDuoId;
  }

  let createdId: string;
  try {
    createdId = await prisma.$transaction(async (tx) => {
      await lockChallengeRow(tx, challengeId);
      await assertChallengeOpenForPostponement(tx, challengeId, new Date());
      const pending = await tx.challengePostponement.findFirst({
        where: { challengeId, status: "PENDING" },
        select: { id: true },
      });
      if (pending) {
        throw new PostponementError(
          "Er staat al een uitstelverzoek open voor deze challenge.",
          "postponement_already_pending",
          409,
        );
      }
      await assertUnderLimit(tx, challengeId, maxPerChallenge);

      const created = await tx.challengePostponement.create({
        data: {
          challengeId,
          requestedByDuoId: requestingDuoId,
          requestedByUserId: actingUserId,
          requestedDays: input.days,
          reason: input.reason ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: "challenge",
          entityId: challengeId,
          action: "postponement_requested",
          performedBy: actingUserId,
          payload: { postponementId: created.id, requestedByDuoId: requestingDuoId, days: input.days },
        },
      });
      return created.id;
    });
  } catch (err) {
    // Vangnet: de partial unique index "één pending per challenge".
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new PostponementError(
        "Er staat al een uitstelverzoek open voor deze challenge.",
        "postponement_already_pending",
        409,
      );
    }
    throw err;
  }

  await notifySafely("uitstel aangevraagd", () => notifyPostponementRequested(createdId));
  return getPostponementDto(createdId);
}

export async function answerPostponement(
  challengeId: string,
  postponementId: string,
  actingUserId: string,
  action: AnswerPostponementInput["action"],
): Promise<PostponementDto> {
  const postponement = await prisma.challengePostponement.findUnique({ where: { id: postponementId } });
  if (!postponement || postponement.challengeId !== challengeId) {
    throw new PostponementError("Uitstelverzoek niet gevonden.", "postponement_not_found", 404);
  }
  const challenge = await loadChallenge(challengeId);
  const { isChallenger, isChallenged } = await memberSides(challenge, actingUserId);
  const memberOf = (duoId: string) =>
    (duoId === challenge.challengerDuoId && isChallenger) || (duoId === challenge.challengedDuoId && isChallenged);

  if (action === "cancel") {
    if (!memberOf(postponement.requestedByDuoId)) {
      throw new PostponementError(
        "Alleen het duo dat uitstel vroeg kan het verzoek intrekken.",
        "not_authorized",
        403,
      );
    }
  } else {
    if (!memberOf(otherDuoId(challenge, postponement.requestedByDuoId))) {
      throw new PostponementError(
        "Alleen het andere duo kan op dit uitstelverzoek reageren.",
        "not_authorized",
        403,
      );
    }
    if (postponement.requestedByUserId === actingUserId) {
      throw new PostponementError(
        "Je kunt niet op je eigen uitstelverzoek reageren.",
        "cannot_answer_own_request",
        403,
      );
    }
  }

  const maxPerChallenge = await getConfigNumber("postponement_max_per_challenge");

  await prisma.$transaction(async (tx) => {
    await lockChallengeRow(tx, challengeId);
    const now = new Date();

    if (action === "accept") {
      const locked = await assertChallengeOpenForPostponement(tx, challengeId, now);
      await assertUnderLimit(tx, challengeId, maxPerChallenge);
      const previous = locked.matchDeadline;
      const next = new Date(previous.getTime() + postponement.requestedDays * DAY_MS);

      const guard = await tx.challengePostponement.updateMany({
        where: { id: postponementId, status: "PENDING" },
        data: {
          status: "ACCEPTED",
          respondedByUserId: actingUserId,
          respondedAt: now,
          previousMatchDeadline: previous,
          newMatchDeadline: next,
        },
      });
      if (guard.count === 0) {
        throw new PostponementError("Dit uitstelverzoek staat niet (meer) open.", "postponement_not_pending", 409);
      }
      await tx.challenge.update({ where: { id: challengeId }, data: { matchDeadline: next } });
      await tx.auditLog.create({
        data: {
          entityType: "challenge",
          entityId: challengeId,
          action: "postponement_accepted",
          performedBy: actingUserId,
          payload: {
            postponementId,
            days: postponement.requestedDays,
            previousMatchDeadline: previous.toISOString(),
            newMatchDeadline: next.toISOString(),
          },
        },
      });
      return;
    }

    const guard = await tx.challengePostponement.updateMany({
      where: { id: postponementId, status: "PENDING" },
      data: {
        status: action === "decline" ? "DECLINED" : "CANCELLED",
        respondedByUserId: actingUserId,
        respondedAt: now,
      },
    });
    if (guard.count === 0) {
      throw new PostponementError("Dit uitstelverzoek staat niet (meer) open.", "postponement_not_pending", 409);
    }
    await tx.auditLog.create({
      data: {
        entityType: "challenge",
        entityId: challengeId,
        action: action === "decline" ? "postponement_declined" : "postponement_cancelled",
        performedBy: actingUserId,
        payload: { postponementId },
      },
    });
  });

  if (action !== "cancel") {
    await notifySafely("uitstel beantwoord", () => notifyPostponementAnswered(postponementId));
  }
  return getPostponementDto(postponementId);
}

type PostponementWithRelations = Prisma.ChallengePostponementGetPayload<{
  include: { requestedByDuo: { select: { name: true } }; challenge: { select: { matchDeadline: true } } };
}>;

function toDto(p: PostponementWithRelations): PostponementDto {
  const proposed =
    p.status === "PENDING" && p.challenge.matchDeadline
      ? new Date(p.challenge.matchDeadline.getTime() + p.requestedDays * DAY_MS).toISOString()
      : null;
  return {
    id: p.id,
    challengeId: p.challengeId,
    requestedByDuoId: p.requestedByDuoId,
    requestedByDuoName: p.requestedByDuo.name,
    requestedDays: p.requestedDays,
    reason: p.reason,
    status: STATUS_NAME[p.status],
    proposedMatchDeadline: proposed,
    previousMatchDeadline: p.previousMatchDeadline?.toISOString() ?? null,
    newMatchDeadline: p.newMatchDeadline?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    respondedAt: p.respondedAt?.toISOString() ?? null,
  };
}

const DTO_INCLUDE = {
  requestedByDuo: { select: { name: true } },
  challenge: { select: { matchDeadline: true } },
} as const;

async function getPostponementDto(postponementId: string): Promise<PostponementDto> {
  const row = await prisma.challengePostponement.findUniqueOrThrow({
    where: { id: postponementId },
    include: DTO_INCLUDE,
  });
  return toDto(row);
}

export async function getPostponementOverview(
  challengeId: string,
  actingUserId: string,
): Promise<PostponementOverview> {
  const challenge = await loadChallenge(challengeId);
  const { isChallenger, isChallenged } = await memberSides(challenge, actingUserId);
  if (!isChallenger && !isChallenged) {
    throw new PostponementError("Je bent geen lid van een van beide betrokken duo's.", "not_a_member", 403);
  }

  const [maxDays, maxPerChallenge, rows, activeMatch] = await Promise.all([
    getConfigNumber("postponement_max_days"),
    getConfigNumber("postponement_max_per_challenge"),
    prisma.challengePostponement.findMany({
      where: { challengeId },
      include: DTO_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
    prisma.match.findFirst({ where: { challengeId, status: { not: "VOIDED" } }, select: { id: true } }),
  ]);

  const history = rows.map(toDto);
  const pendingRow = rows.find((r) => r.status === "PENDING") ?? null;
  const acceptedCount = rows.filter((r) => r.status === "ACCEPTED").length;
  const remaining = Math.max(0, maxPerChallenge - acceptedCount);
  const open =
    challenge.status === "ACCEPTED" &&
    !!challenge.matchDeadline &&
    challenge.matchDeadline > new Date() &&
    !activeMatch;

  const memberOf = (duoId: string) =>
    (duoId === challenge.challengerDuoId && isChallenger) || (duoId === challenge.challengedDuoId && isChallenged);

  return {
    challengeId,
    challengeStatus: challenge.status,
    matchDeadline: challenge.matchDeadline?.toISOString() ?? null,
    maxDays,
    maxPerChallenge,
    acceptedCount,
    remaining,
    canRequest: open && !pendingRow && remaining > 0,
    canRespond:
      open &&
      !!pendingRow &&
      remaining > 0 &&
      pendingRow.requestedByUserId !== actingUserId &&
      memberOf(otherDuoId(challenge, pendingRow.requestedByDuoId)),
    canCancel: !!pendingRow && memberOf(pendingRow.requestedByDuoId),
    pending: pendingRow ? toDto(pendingRow) : null,
    history,
  };
}
