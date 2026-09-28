/**
 * Pure helpers om ratinggeschiedenis om te zetten naar chart-data.
 * Geen React/DOM — ook bruikbaar in server components en unit tests.
 */

export type RatingPoint = { date: Date; rating: number };

/** Vorm zoals /api/duos/[id]/rating-history hem levert (nieuwste eerst). */
export type RatingHistoryEntry = {
  createdAt: string | Date;
  ratingBefore: number;
  ratingAfter: number;
};

/**
 * Zet ratinghistorie (in willekeurige volgorde) om naar een oplopende reeks
 * punten. Het eerste punt is de rating vóór de oudste mutatie, zodat ook een
 * duo met één wedstrijd een lijn (2 punten) krijgt. Bij mutaties op exact
 * hetzelfde tijdstip wordt de API-volgorde (nieuwste eerst) aangehouden.
 */
export function toRatingSeries(entries: readonly RatingHistoryEntry[]): RatingPoint[] {
  if (entries.length === 0) return [];
  const sorted = entries
    .map((entry, index) => ({ entry, index, time: new Date(entry.createdAt).getTime() }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time || b.index - a.index);
  if (sorted.length === 0) return [];

  const first = sorted[0];
  // 1 ms vóór de eerste mutatie: x-waarden blijven strikt oplopend.
  const points: RatingPoint[] = [{ date: new Date(first.time - 1), rating: first.entry.ratingBefore }];
  for (const { entry, time } of sorted) {
    points.push({ date: new Date(time), rating: entry.ratingAfter });
  }
  return points;
}

/** Tier-grenzen (veelvouden van tierSize) binnen [min, max] — voor hulplijnen in de chart. */
export function tierBoundaries(min: number, max: number, tierSize: number): number[] {
  if (!(tierSize > 0) || !Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
  const boundaries: number[] = [];
  for (let value = Math.ceil(min / tierSize) * tierSize; value <= max; value += tierSize) {
    boundaries.push(value);
  }
  return boundaries;
}
