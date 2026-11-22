/**
 * Startrating voor een nieuw duo.
 *
 * Basis (KNLTB-aanvullingen, akkoord PO 2026-09-28; vervangt de vaste 1200
 * uit ELO_Algoritme.md §4): per speler een schatting, het duo start op het
 * gemiddelde van beide spelers, afgerond op een geheel getal. Het duo blijft
 * provisional (matches_played = 0 → hoge K-factor), zodat het snel naar zijn
 * echte niveau convergeert.
 *
 * Startbonus op speelsterkte (lagen A en C, akkoord PO 2026-11-22, zie
 * docs/Advies_Startrating.md):
 * - Een speler MET andere actieve duo's die al gespeeld hebben, gebruikt het
 *   gemiddelde van die echte duo-ratings (gaat altijd voor).
 * - Anders: `defaultRating` + een bonus op basis van de zelf opgegeven
 *   KNLTB-speelsterkte (1 = sterkst, 9 = beginner): elke stap sterker dan
 *   9 = + `levelStep`.
 * - De bonus is ALLEEN OMHOOG (nooit onder default; zelf lager opgeven levert
 *   dus niets op) en begrensd: `unverifiedMaxBonus` zonder verificatie,
 *   `verifiedMaxBonus` als een admin de speelsterkte heeft geverifieerd.
 *
 * Bewust NIET meegenomen: ontbonden duo's (een speler zou anders een
 * slechte rating kunnen "wegontbinden").
 */
import { KNLTB_LEVEL_MAX, KNLTB_LEVEL_MIN } from "@/lib/profile/validation";

export type StartRatingInput = {
  /** Huidige ratings van de andere (gespeelde) actieve duo's van speler A. */
  playerARatings: readonly number[];
  /** Huidige ratings van de andere (gespeelde) actieve duo's van speler B. */
  playerBRatings: readonly number[];
  defaultRating: number;
};

export function playerRatingEstimate(ratings: readonly number[], defaultRating: number): number {
  const valid = ratings.filter((r) => Number.isFinite(r));
  if (valid.length === 0) return defaultRating;
  return valid.reduce((sum, r) => sum + r, 0) / valid.length;
}

export function computeStartRating({ playerARatings, playerBRatings, defaultRating }: StartRatingInput): number {
  assertValidDefault(defaultRating);
  const a = playerRatingEstimate(playerARatings, defaultRating);
  const b = playerRatingEstimate(playerBRatings, defaultRating);
  return Math.max(0, Math.round((a + b) / 2));
}

// ---------------------------------------------------------------------------
// Startbonus op speelsterkte (lagen A + C)
// ---------------------------------------------------------------------------

/** platform_config-keys; de waarden zelf staan in de database (datamigratie). */
export const START_RATING_CONFIG_KEYS = {
  defaultRating: "default_start_rating",
  levelStep: "start_rating_level_step",
  unverifiedMaxBonus: "start_rating_unverified_max_bonus",
  verifiedMaxBonus: "start_rating_verified_max_bonus",
} as const;

/** Fallbacks zolang een config-rij ontbreekt (zelfde waarden als de migratie). */
export const DEFAULT_START_RATING_BONUS_CONFIG = {
  levelStep: 50,
  unverifiedMaxBonus: 200,
  verifiedMaxBonus: 400,
} as const;

export type StartRatingConfig = {
  defaultRating: number;
  levelStep: number;
  unverifiedMaxBonus: number;
  verifiedMaxBonus: number;
};

export type PlayerStartInput = {
  /** Ratings van de ANDERE actieve duo's van deze speler die al gespeeld hebben. */
  playedDuoRatings: readonly number[];
  /** Zelf opgegeven KNLTB-speelsterkte (1-9) of null. */
  knltbLevel: number | null;
  /** True als een admin de speelsterkte heeft geverifieerd. */
  levelVerified: boolean;
};

function assertValidDefault(defaultRating: number): void {
  if (!Number.isFinite(defaultRating) || defaultRating < 0) {
    throw new Error(`Ongeldige default-startrating: ${defaultRating}`);
  }
}

export function assertValidStartRatingConfig(config: StartRatingConfig): void {
  assertValidDefault(config.defaultRating);
  const { levelStep, unverifiedMaxBonus, verifiedMaxBonus } = config;
  for (const [name, value] of Object.entries({ levelStep, unverifiedMaxBonus, verifiedMaxBonus })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Ongeldige startrating-config ${name}: ${value}`);
    }
  }
}

/**
 * Bonus (≥ 0) voor een speelsterkte. Geen of een ongeldige speelsterkte → 0.
 * Ongeverifieerd begrensd op `unverifiedMaxBonus`, geverifieerd op
 * `verifiedMaxBonus` (de hoogste van beide grenzen, zodat verificatie nooit
 * minder oplevert).
 */
export function levelBonus(knltbLevel: number | null, levelVerified: boolean, config: StartRatingConfig): number {
  if (
    knltbLevel === null ||
    !Number.isInteger(knltbLevel) ||
    knltbLevel < KNLTB_LEVEL_MIN ||
    knltbLevel > KNLTB_LEVEL_MAX
  ) {
    return 0;
  }
  const raw = (KNLTB_LEVEL_MAX - knltbLevel) * config.levelStep;
  const cap = levelVerified
    ? Math.max(config.verifiedMaxBonus, config.unverifiedMaxBonus)
    : config.unverifiedMaxBonus;
  return Math.max(0, Math.min(raw, cap));
}

/** Schatting voor één speler: echte duo-ratings gaan voor, anders default + bonus. */
export function playerStartEstimate(player: PlayerStartInput, config: StartRatingConfig): number {
  const valid = player.playedDuoRatings.filter((r) => Number.isFinite(r));
  if (valid.length > 0) {
    return valid.reduce((sum, r) => sum + r, 0) / valid.length;
  }
  return config.defaultRating + levelBonus(player.knltbLevel, player.levelVerified, config);
}

/** Startrating van een duo: gemiddelde van beide spelersschattingen, afgerond. */
export function computeDuoStartRating(
  playerA: PlayerStartInput,
  playerB: PlayerStartInput,
  config: StartRatingConfig,
): number {
  assertValidStartRatingConfig(config);
  const a = playerStartEstimate(playerA, config);
  const b = playerStartEstimate(playerB, config);
  return Math.max(0, Math.round((a + b) / 2));
}
