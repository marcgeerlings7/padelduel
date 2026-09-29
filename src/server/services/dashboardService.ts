import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/elo";
import { getLadder, LadderEntry } from "@/server/services/ladderService";
import { DuoStatsSummary, toDuoStatsSummary } from "@/lib/stats";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";
import { getDuoStats } from "@/server/services/statsService";
import { publicDisplayName } from "@/lib/profile/displayName";

export type DashboardDuoCard = {
  duo: {
    id: string;
    name: string;
    regionId: string;
    regionName: string;
    currentRating: number;
    position: number;
    ladderSize: number;
    tier: number;
    /**
     * Publieke naam van de duo-partner (weergavenaam of neutrale fallback,
     * nooit het e-mailadres); null als er (nog) geen partner is.
     */
    partnerName: string | null;
  } & DuoStatsSummary; // afgeleide statistieken (KNLTB-aanvullingen), zelfde velden als LadderEntry
  above: LadderEntry[];
  below: LadderEntry[];
};

export type DashboardData = {
  duos: DashboardDuoCard[];
  activeDuoCount: number;
  maxActiveDuos: number;
  canFormMoreDuos: boolean;
};

const NEARBY_COUNT = 3;

export async function getDashboard(userId: string): Promise<DashboardData> {
  const memberships = await prisma.duoMembership.findMany({
    where: { userId, leftAt: null, duo: { isActive: true } },
    include: { duo: { include: { region: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const [maxActiveDuos, tierSize] = await Promise.all([
    getConfigNumber("max_active_duos_per_user"),
    getConfigNumber("rating_tier_size"),
  ]);

  // Eén ladder-query per regio, ook als de gebruiker meerdere duo's in
  // dezelfde regio heeft.
  const ladderByRegion = new Map<string, LadderEntry[]>();
  const cards: DashboardDuoCard[] = [];

  for (const membership of memberships) {
    const duo = membership.duo;
    let ladder = ladderByRegion.get(duo.regionId);
    if (!ladder) {
      ladder = await getLadder(duo.regionId);
      ladderByRegion.set(duo.regionId, ladder);
    }

    const ownIndex = ladder.findIndex((entry) => entry.id === duo.id);
    const position = ownIndex >= 0 ? ownIndex + 1 : ladder.length;
    const above = ownIndex >= 0 ? ladder.slice(Math.max(0, ownIndex - NEARBY_COUNT), ownIndex) : [];
    const below =
      ownIndex >= 0 ? ladder.slice(ownIndex + 1, ownIndex + 1 + NEARBY_COUNT) : [];

    // Het eigen duo staat (als actief duo) altijd in de ladder van zijn
    // regio; de losse stats-query is alleen een vangnet.
    const ownEntry = ownIndex >= 0 ? ladder[ownIndex] : null;
    const stats: DuoStatsSummary =
      ownEntry ??
      toDuoStatsSummary((await getDuoStats([{ id: duo.id, createdAt: duo.createdAt }])).get(duo.id)!);

    const partnerMembership = await prisma.duoMembership.findFirst({
      where: { duoId: duo.id, userId: { not: userId }, leftAt: null },
      select: { user: { select: { id: true, displayName: true } } },
    });

    cards.push({
      duo: {
        id: duo.id,
        name: duo.name,
        regionId: duo.regionId,
        regionName: duo.region.name,
        currentRating: duo.currentRating,
        position,
        ladderSize: ladder.length,
        tier: getTier(duo.currentRating, tierSize),
        partnerName: partnerMembership ? publicDisplayName(partnerMembership.user) : null,
        ...toDuoStatsSummary(stats),
      },
      above,
      below,
    });
  }

  return {
    duos: cards,
    activeDuoCount: memberships.length,
    maxActiveDuos,
    canFormMoreDuos: memberships.length < maxActiveDuos,
  };
}
