/**
 * Pure helpers (geen React/DOM) voor de ladder- en dashboardweergave.
 * Tier en positie komen altijd uit de API — hier wordt alleen gegroepeerd
 * en geformatteerd, nooit opnieuw afgeleid.
 */

export type StreakDetail = { result: "W" | "L"; length: number };
export type Reliability = { played: number; total: number; percentage: number | null };

/** Een ladderrij zoals GET /api/ladder hem levert (JSON: datums als string). */
export type LadderRow = {
  id: string;
  name: string;
  currentRating: number;
  position: number;
  tier: number;
  wins: number;
  losses: number;
  streak: string;
  streakDetail: StreakDetail | null;
  setDifference: number;
  gameDifference: number;
  reliability: Reliability;
  inactive: boolean;
  lastActivityAt: string;
};

export type TierGroup<T extends { tier: number }> = { tier: number; entries: T[] };

/**
 * Groepeert opeenvolgende rijen met dezelfde tier (de ladder is op rating
 * gesorteerd, dus elke tier vormt één aaneengesloten blok). Volgorde blijft
 * exact die van de API.
 */
export function groupByTier<T extends { tier: number }>(entries: readonly T[]): TierGroup<T>[] {
  const groups: TierGroup<T>[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.tier === entry.tier) {
      last.entries.push(entry);
    } else {
      groups.push({ tier: entry.tier, entries: [entry] });
    }
  }
  return groups;
}

/**
 * Ratingbereik van een tier, uit de tier (API) en tier_size (API/platform_config).
 * Alleen voor weergave ("1300–1399"); null als tierSize onbekend/ongeldig is.
 */
export function tierRange(
  tier: number,
  tierSize: number | null | undefined,
): { min: number; max: number } | null {
  if (!tierSize || !(tierSize > 0) || !Number.isFinite(tier)) return null;
  return { min: tier * tierSize, max: (tier + 1) * tierSize - 1 };
}

/** Voorleestekst voor een reeks: "3 keer op rij gewonnen" / "Nog geen wedstrijden". */
export function describeStreak(detail: StreakDetail | null): string {
  if (!detail || detail.length <= 0) return "Nog geen reeks";
  const times = detail.length === 1 ? "1 keer" : `${detail.length} keer op rij`;
  return detail.result === "W" ? `${times} gewonnen` : `${times} verloren`;
}

/** "92%" of "—" (nog geen challenges die meetellen). */
export function formatReliability(reliability: Reliability): string {
  return reliability.percentage === null ? "—" : `${reliability.percentage}%`;
}

/** Voorleestekst: "Betrouwbaarheid 92%: 11 van 12 challenges gespeeld". */
export function describeReliability(reliability: Reliability): string {
  if (reliability.percentage === null) return "Betrouwbaarheid: nog geen challenges";
  return `Betrouwbaarheid ${reliability.percentage}%: ${reliability.played} van ${reliability.total} challenges gespeeld`;
}

/** Winst–verlies als "4–1" (en-dash, geen minteken). */
export function formatRecord(wins: number, losses: number): string {
  return `${wins}–${losses}`;
}

/** Positief verschil (in punten) tussen twee ratings, afgerond. */
export function ratingGap(from: number, to: number): number {
  return Math.round(Math.abs(to - from));
}
