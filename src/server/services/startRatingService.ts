/**
 * Startrating & plaatsing (akkoord PO 2026-11-22, docs/Advies_Startrating.md).
 *
 * - Config laden (laag A/B/C) uit platform_config.
 * - Spelersinvoer voor de startrating bepalen (gespeelde andere duo's,
 *   speelsterkte, verificatie).
 * - Laag D: startratings van nog-niet-gespeelde duo's herberekenen
 *   (lanceer-seeding per regio, of na verificatie van één speler).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeDuoStartRating,
  DEFAULT_START_RATING_BONUS_CONFIG,
  START_RATING_CONFIG_KEYS,
  type PlayerStartInput,
  type StartRatingConfig,
} from "@/lib/duo/startRating";
import {
  assertValidPlacementConfig,
  DEFAULT_PLACEMENT_CONFIG,
  PLACEMENT_CONFIG_KEYS,
  type PlacementConfig,
} from "@/lib/challenge/placement";
import { getConfigNumber, getConfigNumberOrDefault } from "@/server/repositories/platformConfigRepository";

type Tx = Prisma.TransactionClient;

export async function getStartRatingConfig(): Promise<StartRatingConfig> {
  const [defaultRating, levelStep, unverifiedMaxBonus, verifiedMaxBonus] = await Promise.all([
    getConfigNumber(START_RATING_CONFIG_KEYS.defaultRating),
    getConfigNumberOrDefault(START_RATING_CONFIG_KEYS.levelStep, DEFAULT_START_RATING_BONUS_CONFIG.levelStep),
    getConfigNumberOrDefault(
      START_RATING_CONFIG_KEYS.unverifiedMaxBonus,
      DEFAULT_START_RATING_BONUS_CONFIG.unverifiedMaxBonus,
    ),
    getConfigNumberOrDefault(
      START_RATING_CONFIG_KEYS.verifiedMaxBonus,
      DEFAULT_START_RATING_BONUS_CONFIG.verifiedMaxBonus,
    ),
  ]);
  return { defaultRating, levelStep, unverifiedMaxBonus, verifiedMaxBonus };
}

export async function getPlacementConfig(): Promise<PlacementConfig> {
  const [maxMatches, tiersUp] = await Promise.all([
    getConfigNumberOrDefault(PLACEMENT_CONFIG_KEYS.maxMatches, DEFAULT_PLACEMENT_CONFIG.maxMatches),
    getConfigNumberOrDefault(PLACEMENT_CONFIG_KEYS.tiersUp, DEFAULT_PLACEMENT_CONFIG.tiersUp),
  ]);
  const config = { maxMatches, tiersUp };
  assertValidPlacementConfig(config);
  return config;
}

/**
 * Invoer voor één speler. Alleen ANDERE actieve duo's die al minstens één
 * wedstrijd gespeeld hebben tellen als "echte" rating: een ongespeeld duo
 * staat zelf nog op een startschatting (en zou een speelsterktebonus anders
 * wegmiddelen naar de oude default).
 */
export async function playerStartInput(tx: Tx, userId: string, excludeDuoId?: string): Promise<PlayerStartInput> {
  const [user, duos] = await Promise.all([
    tx.user.findUnique({ where: { id: userId }, select: { knltbLevel: true, knltbLevelVerifiedAt: true } }),
    tx.duo.findMany({
      where: {
        isActive: true,
        matchesPlayed: { gt: 0 },
        memberships: { some: { userId, leftAt: null } },
        ...(excludeDuoId ? { id: { not: excludeDuoId } } : {}),
      },
      select: { currentRating: true },
    }),
  ]);
  return {
    playedDuoRatings: duos.map((d) => d.currentRating),
    knltbLevel: user?.knltbLevel ?? null,
    levelVerified: !!user?.knltbLevelVerifiedAt,
  };
}

export type StartRatingChange = { duoId: string; duoName: string; from: number; to: number };
export type RecalculateResult = { checked: number; changed: StartRatingChange[] };

/**
 * Laag D: herberekent de startrating van actieve duo's die nog NIETS hebben
 * gedaan — geen gespeelde wedstrijd, geen rating-historie en nooit een
 * challenge (in welke status dan ook). Zo verschuift er nooit een duo
 * midden in een lopende uitdaging en blijft er geen historie onverklaard.
 *
 * Geen RatingHistory-rij (net als bij het aanmaken van een duo: een
 * startrating is geen ratingwijziging door spel); wel één audit_log-rij per
 * run met alle wijzigingen. Alles in één transactie, met een row lock op de
 * betrokken duo's.
 */
export async function recalculateStartRatings(
  scope: { regionId: string } | { userId: string },
  actingAdminId: string,
): Promise<RecalculateResult> {
  const config = await getStartRatingConfig();

  return prisma.$transaction(async (tx) => {
    const candidates = await tx.duo.findMany({
      where: {
        isActive: true,
        matchesPlayed: 0,
        ratingHistory: { none: {} },
        challengesAsChallenger: { none: {} },
        challengesAsChallenged: { none: {} },
        ...("regionId" in scope
          ? { regionId: scope.regionId }
          : { memberships: { some: { userId: scope.userId, leftAt: null } } }),
      },
      select: {
        id: true,
        name: true,
        currentRating: true,
        memberships: { where: { leftAt: null }, select: { userId: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (candidates.length > 0) {
      const ids = candidates.map((d) => d.id);
      await tx.$queryRaw`SELECT id FROM "duo" WHERE id = ANY(${ids}::uuid[]) FOR UPDATE`;
    }

    const changed: StartRatingChange[] = [];
    for (const duo of candidates) {
      if (duo.memberships.length !== 2) continue;
      const [a, b] = await Promise.all(
        duo.memberships.map((m) => playerStartInput(tx, m.userId, duo.id)),
      );
      const target = computeDuoStartRating(a, b, config);
      if (target === duo.currentRating) continue;
      await tx.duo.update({ where: { id: duo.id }, data: { currentRating: target } });
      changed.push({ duoId: duo.id, duoName: duo.name, from: duo.currentRating, to: target });
    }

    if (changed.length > 0) {
      const scopeIsRegion = "regionId" in scope;
      await tx.auditLog.create({
        data: {
          entityType: scopeIsRegion ? "region" : "app_user",
          entityId: scopeIsRegion ? scope.regionId : scope.userId,
          action: "start_ratings_recalculated",
          performedBy: actingAdminId,
          payload: { changes: changed.map(({ duoId, from, to }) => ({ duoId, from, to })) },
        },
      });
    }

    return { checked: candidates.length, changed };
  });
}
