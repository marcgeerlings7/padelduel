/**
 * Plaatsingsperiode (laag B, akkoord PO 2026-11-22, zie
 * docs/Advies_Startrating.md). Uitzondering op FR-4.2 ("alleen binnen de
 * eigen tier"):
 *
 * - Een duo dat nog minder dan `maxMatches` wedstrijden heeft gespeeld, mag
 *   behalve de eigen tier ook duo's tot `tiersUp` tiers HOGER uitdagen.
 * - Omlaag blijft altijd alleen de eigen tier.
 * - Hogere duo's mogen zo'n uitdaging gewoon weigeren; weigeren kent geen
 *   penalty (alleen niet-reageren, FR-4.4).
 *
 * Tiers blijven afgeleid (getTier); hier wordt alleen het toegestane bereik
 * berekend. Pure functies, geen I/O.
 */

export const PLACEMENT_CONFIG_KEYS = {
  maxMatches: "placement_max_matches",
  tiersUp: "placement_challenge_tiers_up",
} as const;

/** Fallbacks zolang een config-rij ontbreekt (zelfde waarden als de migratie). */
export const DEFAULT_PLACEMENT_CONFIG: PlacementConfig = { maxMatches: 10, tiersUp: 2 };

export type PlacementConfig = {
  /** Aantal gespeelde wedstrijden waarna de plaatsingsperiode eindigt. */
  maxMatches: number;
  /** Hoeveel tiers hoger een duo in de plaatsingsperiode mag uitdagen. */
  tiersUp: number;
};

export function assertValidPlacementConfig(config: PlacementConfig): void {
  for (const [name, value] of Object.entries(config)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Ongeldige plaatsings-config ${name}: ${value}`);
    }
  }
}

export function isInPlacement(matchesPlayed: number, config: PlacementConfig): boolean {
  return matchesPlayed < config.maxMatches;
}

/** Resterende plaatsingswedstrijden (0 buiten de plaatsingsperiode). */
export function placementMatchesLeft(matchesPlayed: number, config: PlacementConfig): number {
  return Math.max(0, config.maxMatches - Math.max(0, matchesPlayed));
}

/** Inclusief bereik van tiers dat een duo mag uitdagen. */
export function challengeableTierRange(
  tier: number,
  matchesPlayed: number,
  config: PlacementConfig,
): { min: number; max: number } {
  assertValidPlacementConfig(config);
  return { min: tier, max: tier + (isInPlacement(matchesPlayed, config) ? config.tiersUp : 0) };
}

export function canChallengeTier(
  challengerTier: number,
  challengerMatchesPlayed: number,
  challengedTier: number,
  config: PlacementConfig,
): boolean {
  const { min, max } = challengeableTierRange(challengerTier, challengerMatchesPlayed, config);
  return challengedTier >= min && challengedTier <= max;
}
