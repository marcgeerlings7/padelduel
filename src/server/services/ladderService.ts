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
  wins: number;
  losses: number;
  streak: string;
};

type RawLadderEntry = Omit<LadderEntry, "tier" | "wins" | "losses" | "streak">;

type RecordStats = { wins: number; losses: number; streak: string };

/**
 * W-L-record en streak zijn, net als positie en tier, AFGELEID —
 * berekend uit RatingHistory (niet apart bijgehouden). Een entry telt
 * als winst wanneer ratingAfter > ratingBefore en het geen forfeit is
 * (bij een echte ELO-verwerking is de winnaar-delta per definitie
 * positief, de verliezer-delta negatief — zie ELO_Algoritme.md). Een
 * forfeit-penalty telt altijd als verlies.
 */
async function getRecordsAndStreaks(duoIds: string[]): Promise<Map<string, RecordStats>> {
  if (duoIds.length === 0) return new Map();

  const historyRows = await prisma.ratingHistory.findMany({
    where: { duoId: { in: duoIds } },
    orderBy: { createdAt: "asc" },
    select: { duoId: true, isForfeit: true, ratingBefore: true, ratingAfter: true },
  });

  const resultsByDuo = new Map<string, boolean[]>();
  for (const h of historyRows) {
    const won = !h.isForfeit && h.ratingAfter > h.ratingBefore;
    const arr = resultsByDuo.get(h.duoId) ?? [];
    arr.push(won);
    resultsByDuo.set(h.duoId, arr);
  }

  const stats = new Map<string, RecordStats>();
  for (const duoId of duoIds) {
    const results = resultsByDuo.get(duoId) ?? [];
    const wins = results.filter(Boolean).length;
    const losses = results.length - wins;

    let streak = "—";
    if (results.length > 0) {
      const last = results[results.length - 1];
      let count = 0;
      for (let i = results.length - 1; i >= 0 && results[i] === last; i--) count++;
      streak = `${last ? "W" : "L"}${count}`;
    }

    stats.set(duoId, { wins, losses, streak });
  }
  return stats;
}

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

  const stats = await getRecordsAndStreaks(rows.map((row) => row.id));

  return rows.map((row) => {
    const s = stats.get(row.id) ?? { wins: 0, losses: 0, streak: "—" };
    return { ...row, tier: getTier(row.currentRating, tierSize), ...s };
  });
}
