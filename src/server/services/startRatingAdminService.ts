/**
 * Beheer van startratings (akkoord PO 2026-11-22, docs/Advies_Startrating.md):
 * - laag C: openstaande verificatie-aanvragen van de KNLTB-speelsterkte
 *   goedkeuren/afwijzen (met audit_log; na goedkeuring worden de nog niet
 *   gespeelde duo's van de speler herberekend);
 * - laag D: lanceer-seeding per regio (zie recalculateStartRatings).
 */
import { prisma } from "@/lib/prisma";
import { levelBonus } from "@/lib/duo/startRating";
import {
  getStartRatingConfig,
  recalculateStartRatings,
  type RecalculateResult,
} from "@/server/services/startRatingService";

export class StartRatingAdminError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

export type VerificationRequest = {
  userId: string;
  /** Admins mogen het e-mailadres zien: daarmee vragen ze de schermafbeelding op. */
  email: string;
  displayName: string | null;
  knltbLevel: number;
  requestedAt: Date;
  /** Bonus die de speler na goedkeuring krijgt (vs. nu, ongeverifieerd). */
  bonusIfVerified: number;
  bonusNow: number;
};

export type StartRatingOverview = {
  requests: VerificationRequest[];
  regions: Array<{ id: string; name: string; unplayedDuoCount: number }>;
};

export async function getStartRatingOverview(): Promise<StartRatingOverview> {
  const [config, users, regions] = await Promise.all([
    getStartRatingConfig(),
    prisma.user.findMany({
      where: { knltbVerificationRequestedAt: { not: null }, knltbLevelVerifiedAt: null, knltbLevel: { not: null } },
      select: { id: true, email: true, displayName: true, knltbLevel: true, knltbVerificationRequestedAt: true },
      orderBy: { knltbVerificationRequestedAt: "asc" },
      take: 200,
    }),
    prisma.region.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { duos: { where: { isActive: true, matchesPlayed: 0 } } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    requests: users.map((u) => ({
      userId: u.id,
      email: u.email,
      displayName: u.displayName,
      knltbLevel: u.knltbLevel!,
      requestedAt: u.knltbVerificationRequestedAt!,
      bonusIfVerified: levelBonus(u.knltbLevel, true, config),
      bonusNow: levelBonus(u.knltbLevel, false, config),
    })),
    regions: regions.map((r) => ({ id: r.id, name: r.name, unplayedDuoCount: r._count.duos })),
  };
}

export type VerificationDecisionResult = {
  status: "verified" | "rejected";
  recalculated: RecalculateResult | null;
};

export async function decideVerification(
  userId: string,
  decision: "approve" | "reject",
  actingAdminId: string,
): Promise<VerificationDecisionResult> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, knltbLevel: true, knltbVerificationRequestedAt: true, knltbLevelVerifiedAt: true },
    });
    if (!user) {
      throw new StartRatingAdminError("Gebruiker niet gevonden.", "user_not_found", 404);
    }
    // Voorwaardelijke update = guard tegen een dubbele/gelijktijdige beslissing
    // en tegen een speelsterkte die net gewijzigd is (dan is de aanvraag weg).
    const updated = await tx.user.updateMany({
      where: {
        id: userId,
        knltbVerificationRequestedAt: { not: null },
        knltbLevelVerifiedAt: null,
        knltbLevel: user.knltbLevel ?? -1,
      },
      data:
        decision === "approve"
          ? { knltbLevelVerifiedAt: new Date(), knltbLevelVerifiedById: actingAdminId, knltbVerificationRequestedAt: null }
          : { knltbVerificationRequestedAt: null },
    });
    if (updated.count === 0 || user.knltbLevel === null) {
      throw new StartRatingAdminError(
        "Er staat (niet meer) een verificatie-aanvraag open voor deze speler.",
        "no_pending_request",
        409,
      );
    }
    await tx.auditLog.create({
      data: {
        entityType: "app_user",
        entityId: userId,
        action: decision === "approve" ? "knltb_level_verified" : "knltb_level_verification_rejected",
        performedBy: actingAdminId,
        payload: { knltbLevel: user.knltbLevel },
      },
    });
  });

  if (decision === "reject") {
    return { status: "rejected", recalculated: null };
  }
  // Na de commit: de nog niet gespeelde duo's van deze speler krijgen de
  // geverifieerde bonus (laag D voor één speler).
  const recalculated = await recalculateStartRatings({ userId }, actingAdminId);
  return { status: "verified", recalculated };
}

export async function recalculateRegionStartRatings(
  regionId: string,
  actingAdminId: string,
): Promise<RecalculateResult> {
  const region = await prisma.region.findUnique({ where: { id: regionId }, select: { id: true } });
  if (!region) {
    throw new StartRatingAdminError("Regio niet gevonden.", "region_not_found", 404);
  }
  return recalculateStartRatings({ regionId }, actingAdminId);
}
