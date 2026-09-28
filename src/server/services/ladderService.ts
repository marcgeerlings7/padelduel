import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/elo";
import { DuoStatsSummary, toDuoStatsSummary } from "@/lib/stats";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";
import { getDuoStats } from "@/server/services/statsService";

export type LadderPosition = {
  id: string;
  name: string;
  regionId: string;
  currentRating: number;
  createdAt: Date;
  position: number;
  tier: number;
};

/**
 * Ladderrij incl. afgeleide statistieken (zie statsService/src/lib/stats).
 * `wins`/`losses`/`streak` bestonden al; sinds de KNLTB-aanvullingen
 * tellen daarin uitsluitend BEVESTIGDE matches (voorheen telde een
 * forfeit-penalty als verlies — forfeits zitten nu in `reliability`).
 */
export type LadderEntry = LadderPosition & DuoStatsSummary;

type RawLadderEntry = Omit<LadderPosition, "tier">;

/**
 * Ladderpositie is een AFGELEIDE waarde (FR-3.3), berekend via een SQL
 * window function — nooit een opgeslagen kolom. ROW_NUMBER() (i.p.v. een
 * kale RANK()) zodat de tiebreaker uit US-C1 ("bij gelijke rating op
 * created_at, oudste eerst") ook daadwerkelijk de positie bepaalt i.p.v.
 * genegeerd te worden door gelijke ranks.
 *
 * Rating-tier (FR-3.5/FR-4.2) is eveneens afgeleid — floor(rating /
 * tier_size) — nooit een kolom.
 */
export async function getLadderPositions(regionId: string): Promise<LadderPosition[]> {
  const [rows, tierSize] = await Promise.all([
    prisma.$queryRaw<RawLadderEntry[]>`
      SELECT
        id,
        name,
        region_id AS "regionId",
        current_rating AS "currentRating",
        created_at AS "createdAt",
        (ROW_NUMBER() OVER (ORDER BY current_rating DESC, created_at ASC))::int AS position
      FROM duo
      WHERE region_id = ${regionId}::uuid AND is_active = true
      ORDER BY current_rating DESC, created_at ASC
    `,
    getConfigNumber("rating_tier_size"),
  ]);

  return rows.map((row) => ({ ...row, tier: getTier(row.currentRating, tierSize) }));
}

/**
 * Ladder incl. W-L, reeks, saldo's, betrouwbaarheid en inactief-vlag voor
 * ALLE duo's van de regio — in twee extra geaggregeerde queries (geen N+1).
 */
export async function getLadder(regionId: string): Promise<LadderEntry[]> {
  const positions = await getLadderPositions(regionId);
  const stats = await getDuoStats(positions.map((p) => ({ id: p.id, createdAt: p.createdAt })));
  return positions.map((p) => ({ ...p, ...toDuoStatsSummary(stats.get(p.id)!) }));
}
