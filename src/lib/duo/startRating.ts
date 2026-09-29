/**
 * Startrating voor een nieuw duo (KNLTB-aanvullingen, akkoord PO
 * 2026-09-28; vervangt de vaste 1200 uit ELO_Algoritme.md §4).
 *
 * Per speler: het gemiddelde van de huidige ratings van zijn/haar ANDERE
 * actieve duo's; een speler zonder actieve duo's telt mee met
 * `defaultRating` (platform_config.default_start_rating). Het nieuwe duo
 * start op het gemiddelde van beide spelerswaarden, afgerond op een geheel
 * getal. Het duo blijft provisional (matches_played = 0 → hoge K-factor),
 * zodat het snel naar zijn echte niveau convergeert.
 *
 * Bewust NIET meegenomen: de zelf opgegeven KNLTB-speelsterkte (niet
 * geverifieerd, dus manipuleerbaar) en ontbonden duo's (een speler zou
 * anders een slechte rating kunnen "wegontbinden").
 */
export type StartRatingInput = {
  /** Huidige ratings van de andere actieve duo's van speler A. */
  playerARatings: readonly number[];
  /** Huidige ratings van de andere actieve duo's van speler B. */
  playerBRatings: readonly number[];
  defaultRating: number;
};

export function playerRatingEstimate(ratings: readonly number[], defaultRating: number): number {
  const valid = ratings.filter((r) => Number.isFinite(r));
  if (valid.length === 0) return defaultRating;
  return valid.reduce((sum, r) => sum + r, 0) / valid.length;
}

export function computeStartRating({ playerARatings, playerBRatings, defaultRating }: StartRatingInput): number {
  if (!Number.isFinite(defaultRating) || defaultRating < 0) {
    throw new Error(`Ongeldige default-startrating: ${defaultRating}`);
  }
  const a = playerRatingEstimate(playerARatings, defaultRating);
  const b = playerRatingEstimate(playerBRatings, defaultRating);
  return Math.max(0, Math.round((a + b) / 2));
}
