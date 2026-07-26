import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/elo";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";

export type LadderEntry = {
  id: string;
  name: string;
  regionId: string;
  currentRating: number;
  createdAt: Date;
  position: number;
  tier: number;
};

type RawLadderEntry = Omit<LadderEntry, "tier">;

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
export async function getLadder(regionId: string): Promise<LadderEntry[]> {
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
