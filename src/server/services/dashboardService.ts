import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/elo";
import { getLadder, LadderEntry } from "@/server/services/ladderService";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";

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
    partnerEmail: string | null;
  };
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

    const partnerMembership = await prisma.duoMembership.findFirst({
      where: { duoId: duo.id, userId: { not: userId }, leftAt: null },
      include: { user: true },
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
        partnerEmail: partnerMembership?.user.email ?? null,
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
