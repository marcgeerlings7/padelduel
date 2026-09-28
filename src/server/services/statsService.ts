import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildMatchHistory,
  computeDuoRecord,
  computeHeadToHead,
  computeReliability,
  CompletedMatchRow,
  DEFAULT_INACTIVE_AFTER_DAYS,
  DuoRef,
  DuoStats,
  groupMatchesByDuo,
  HeadToHeadSummary,
  HistoryRatingRow,
  INACTIVE_AFTER_DAYS_KEY,
  isInactive,
  lastActivityAt,
  MatchHistoryEntry,
} from "@/lib/stats";
import { getConfigNumberOrDefault } from "@/server/repositories/platformConfigRepository";

/**
 * Afgeleide duo-statistieken (KNLTB-aanvullingen, akkoord PO 2026-09-28).
 * Niets wordt opgeslagen; de rekenregels staan in src/lib/stats (puur,
 * getest), deze service levert alleen de ruwe rijen — met een vast,
 * klein aantal queries per aanroep (geen N+1), ook voor een hele ladder.
 */

export class StatsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

export type DuoStatsInput = { id: string; createdAt: Date };

type ChallengeAggregateRow = {
  duoId: string;
  played: number;
  forfeited: number;
  lastChallengeSentAt: Date | null;
  lastChallengeAcceptedAt: Date | null;
};

async function getCompletedMatchesFor(duoIds: string[]): Promise<CompletedMatchRow[]> {
  const rows = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      challenge: {
        OR: [{ challengerDuoId: { in: duoIds } }, { challengedDuoId: { in: duoIds } }],
      },
    },
    select: {
      id: true,
      challengeId: true,
      scoreRaw: true,
      submittedAt: true,
      confirmedAt: true,
      challenge: { select: { challengerDuoId: true, challengedDuoId: true } },
    },
  });
  return rows.map((r) => ({
    matchId: r.id,
    challengeId: r.challengeId,
    challengerDuoId: r.challenge.challengerDuoId,
    challengedDuoId: r.challenge.challengedDuoId,
    scoreRaw: r.scoreRaw,
    submittedAt: r.submittedAt,
    confirmedAt: r.confirmedAt,
  }));
}

/**
 * Eén geaggregeerde query voor betrouwbaarheid en challenge-activiteit
 * van alle gevraagde duo's (zie computeReliability voor de telregels).
 * Een forfeit telt niet voor een duo dat een correctie-record kreeg
 * (resolved_overturned forfeit-dispute met de schuld bij de ander).
 */
async function getChallengeAggregates(duoIds: string[]): Promise<Map<string, ChallengeAggregateRow>> {
  const rows = await prisma.$queryRaw<ChallengeAggregateRow[]>`
    WITH involvement AS (
      SELECT c.id AS challenge_id, c.challenger_duo_id AS duo_id, 'challenger' AS role,
             c.status::text AS status, c.created_at, c.accepted_at
      FROM challenge c
      WHERE c.challenger_duo_id = ANY(${duoIds}::uuid[])
      UNION ALL
      SELECT c.id, c.challenged_duo_id, 'challenged',
             c.status::text, c.created_at, c.accepted_at
      FROM challenge c
      WHERE c.challenged_duo_id = ANY(${duoIds}::uuid[])
    )
    SELECT
      i.duo_id::text AS "duoId",
      (COUNT(*) FILTER (WHERE i.status = 'completed'))::int AS played,
      (COUNT(*) FILTER (
        WHERE (i.status = 'unplayed_timeout' OR (i.status = 'expired' AND i.role = 'challenged'))
          AND NOT EXISTS (
            SELECT 1 FROM rating_history rh
            WHERE rh.duo_id = i.duo_id
              AND rh.challenge_id = i.challenge_id
              AND rh.is_forfeit = true
              AND rh.rating_after > rh.rating_before
          )
      ))::int AS forfeited,
      MAX(i.created_at) FILTER (WHERE i.role = 'challenger') AS "lastChallengeSentAt",
      MAX(i.accepted_at) FILTER (WHERE i.role = 'challenged') AS "lastChallengeAcceptedAt"
    FROM involvement i
    GROUP BY i.duo_id
  `;
  return new Map(rows.map((r) => [r.duoId, r]));
}

export async function getInactiveAfterDays(): Promise<number> {
  return getConfigNumberOrDefault(INACTIVE_AFTER_DAYS_KEY, DEFAULT_INACTIVE_AFTER_DAYS);
}

/**
 * Statistieken voor een willekeurige set duo's in precies twee queries
 * (bevestigde matches + challenge-aggregaten), onafhankelijk van het
 * aantal duo's — gebruikt door de ladder (alle duo's van een regio) en het
 * dashboard.
 */
export async function getDuoStats(duos: DuoStatsInput[], now: Date = new Date()): Promise<Map<string, DuoStats>> {
  const result = new Map<string, DuoStats>();
  if (duos.length === 0) return result;

  const duoIds = duos.map((d) => d.id);
  const [matches, aggregates, inactiveAfterDays] = await Promise.all([
    getCompletedMatchesFor(duoIds),
    getChallengeAggregates(duoIds),
    getInactiveAfterDays(),
  ]);
  const matchesByDuo = groupMatchesByDuo(matches, duoIds);

  for (const duo of duos) {
    const record = computeDuoRecord(duo.id, matchesByDuo.get(duo.id) ?? []);
    const agg = aggregates.get(duo.id);
    const lastActivity = lastActivityAt({
      duoCreatedAt: duo.createdAt,
      lastConfirmedMatchAt: record.lastConfirmedMatchAt,
      lastChallengeSentAt: agg?.lastChallengeSentAt ?? null,
      lastChallengeAcceptedAt: agg?.lastChallengeAcceptedAt ?? null,
    });
    result.set(duo.id, {
      ...record,
      reliability: computeReliability(agg?.played ?? 0, agg?.forfeited ?? 0),
      inactive: isInactive(lastActivity, now, inactiveAfterDays),
      lastActivityAt: lastActivity,
    });
  }
  return result;
}

const duoRefSelect = { select: { id: true, name: true } } satisfies Prisma.DuoDefaultArgs;

async function getDuoRef(duoId: string): Promise<DuoRef & { createdAt: Date; isActive: boolean }> {
  const duo = await prisma.duo.findUnique({
    where: { id: duoId },
    select: { id: true, name: true, createdAt: true, isActive: true },
  });
  if (!duo) {
    throw new StatsError("Duo niet gevonden.", "duo_not_found", 404);
  }
  return duo;
}

export type MatchHistoryPage = {
  duo: DuoRef & { isActive: boolean };
  summary: DuoStats;
  entries: MatchHistoryEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/**
 * Wedstrijdhistorie van één duo, gepagineerd (nieuwste eerst). Drie
 * queries voor de historie zelf (duo, matches, rating-rijen incl.
 * forfeit-challenges) plus twee voor de samenvatting. De samenvoeging
 * van matches en forfeits gebeurt in het geheugen; bij een realistisch
 * aantal wedstrijden per duo (tientallen tot enkele honderden) is dat
 * goedkoper dan een UNION met OFFSET in SQL.
 */
export async function getMatchHistory(
  duoId: string,
  options: { page: number; pageSize: number },
  now: Date = new Date(),
): Promise<MatchHistoryPage> {
  const duo = await getDuoRef(duoId);

  const [matches, ratingRows, statsMap] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: { in: ["COMPLETED", "VOIDED"] },
        challenge: { OR: [{ challengerDuoId: duoId }, { challengedDuoId: duoId }] },
      },
      select: {
        id: true,
        challengeId: true,
        status: true,
        scoreRaw: true,
        submittedAt: true,
        confirmedAt: true,
        challenge: { select: { challengerDuo: duoRefSelect, challengedDuo: duoRefSelect } },
      },
    }),
    prisma.ratingHistory.findMany({
      where: { duoId },
      select: {
        matchId: true,
        challengeId: true,
        ratingBefore: true,
        ratingAfter: true,
        isForfeit: true,
        createdAt: true,
        challenge: {
          select: { id: true, status: true, challengerDuo: duoRefSelect, challengedDuo: duoRefSelect },
        },
      },
    }),
    getDuoStats([{ id: duo.id, createdAt: duo.createdAt }], now),
  ]);

  const entries = buildMatchHistory(
    duoId,
    matches.map((m) => ({
      matchId: m.id,
      challengeId: m.challengeId,
      status: m.status as "COMPLETED" | "VOIDED",
      challengerDuo: m.challenge.challengerDuo,
      challengedDuo: m.challenge.challengedDuo,
      scoreRaw: m.scoreRaw,
      submittedAt: m.submittedAt,
      confirmedAt: m.confirmedAt,
    })),
    ratingRows satisfies HistoryRatingRow[],
  );

  const { page, pageSize } = options;
  const start = (page - 1) * pageSize;
  return {
    duo: { id: duo.id, name: duo.name, isActive: duo.isActive },
    summary: statsMap.get(duo.id)!,
    entries: entries.slice(start, start + pageSize),
    page,
    pageSize,
    total: entries.length,
    totalPages: Math.ceil(entries.length / pageSize),
  };
}

export type HeadToHead = HeadToHeadSummary & {
  duo: DuoRef;
  opponent: DuoRef;
};

/** Onderling resultaat tussen twee duo's (vanuit `duoId`), in vier queries. */
export async function getHeadToHead(duoId: string, otherDuoId: string): Promise<HeadToHead> {
  if (duoId === otherDuoId) {
    throw new StatsError("Een duo heeft geen onderling resultaat met zichzelf.", "same_duo", 400);
  }
  const [duo, opponent] = await Promise.all([getDuoRef(duoId), getDuoRef(otherDuoId)]);

  const rows = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      challenge: {
        OR: [
          { challengerDuoId: duoId, challengedDuoId: otherDuoId },
          { challengerDuoId: otherDuoId, challengedDuoId: duoId },
        ],
      },
    },
    select: {
      id: true,
      challengeId: true,
      scoreRaw: true,
      submittedAt: true,
      confirmedAt: true,
      challenge: { select: { challengerDuoId: true, challengedDuoId: true } },
    },
  });
  const matches: CompletedMatchRow[] = rows.map((r) => ({
    matchId: r.id,
    challengeId: r.challengeId,
    challengerDuoId: r.challenge.challengerDuoId,
    challengedDuoId: r.challenge.challengedDuoId,
    scoreRaw: r.scoreRaw,
    submittedAt: r.submittedAt,
    confirmedAt: r.confirmedAt,
  }));

  const ratingRows =
    matches.length === 0
      ? []
      : await prisma.ratingHistory.findMany({
          where: { matchId: { in: matches.map((m) => m.matchId) }, duoId: { in: [duoId, otherDuoId] } },
          select: { duoId: true, matchId: true, ratingBefore: true, ratingAfter: true },
        });

  const summary = computeHeadToHead(
    duoId,
    otherDuoId,
    matches,
    ratingRows.flatMap((r) => (r.matchId ? [{ ...r, matchId: r.matchId }] : [])),
  );
  return {
    duo: { id: duo.id, name: duo.name },
    opponent: { id: opponent.id, name: opponent.name },
    ...summary,
  };
}
