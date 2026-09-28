import { Duo, KFactorConfig, DEFAULT_K_FACTOR_CONFIG } from "./types";
import { expectedScore } from "./expectedScore";
import { getKFactor } from "./kFactor";
import { DEFAULT_MARGIN_CONFIG, MarginConfig, gameMargin, marginMultiplier } from "./gameMargin";

const DEFAULT_RATING_CAP = 50;
// ELO_Algoritme.md §6.2: rating-impact van de 2e+ wedstrijd tussen
// dezelfde twee duo's binnen het venster wordt gedempt (gehalveerde K-factor).
const REPEATED_OPPONENT_DAMPING_FACTOR = 0.5;

export type ApplyMatchResultParams = {
  winner: Duo;
  loser: Duo;
  winnerPercentile: number;
  loserPercentile: number;
  /**
   * Of dit duo-koppel al eerder tegen elkaar speelde binnen het
   * anti-manipulatie-venster (bijv. 14 dagen). De daadwerkelijke
   * matchhistorie-lookup vereist de database en gebeurt door de
   * aanroeper (Sprint 3) — deze module blijft DB-onafhankelijk.
   */
  isRepeatedOpponentWithinWindow?: boolean;
  kFactorConfig?: KFactorConfig;
  ratingCap?: number;
  /**
   * Games van winnaar en verliezer volgens de KNLTB-telling (match-tiebreak
   * = 1-0, zie summarizeScore). Weggelaten = klassieke ELO zonder
   * gamesaldo (multiplier 1) — alleen bedoeld voor tests/aanroepers zonder
   * uitslag; matchService geeft de games altijd mee (ELO_Algoritme.md §2bis).
   */
  games?: { winner: number; loser: number };
  marginConfig?: MarginConfig;
};

export type ApplyMatchResultOutcome = {
  winnerNewRating: number;
  loserNewRating: number;
  /** Effectief toegepaste K (incl. demping en gamesaldo-multiplier). */
  winnerKFactor: number;
  loserKFactor: number;
  /** Gamesaldo-multiplier M (1 als er geen games zijn meegegeven). */
  marginMultiplier: number;
};

function clamp(delta: number, cap: number): number {
  return Math.max(-cap, Math.min(cap, delta));
}

/**
 * Symmetrisch afronden (half van nul af), zodat +7.5/-7.5 als +8/-8
 * uitkomen: bij gelijke K-factoren blijft de update exact zero-sum
 * (Math.round zou -7.5 naar -7 afronden).
 */
function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Minimaal 1 punt: de winnaar wint altijd, de verliezer verliest altijd (§2bis). */
const MIN_ABS_DELTA = 1;

/** ELO_Algoritme.md §5-§6. */
export function applyMatchResult(params: ApplyMatchResultParams): ApplyMatchResultOutcome {
  const {
    winner,
    loser,
    winnerPercentile,
    loserPercentile,
    isRepeatedOpponentWithinWindow = false,
    kFactorConfig = DEFAULT_K_FACTOR_CONFIG,
    ratingCap = DEFAULT_RATING_CAP,
    games,
    marginConfig = DEFAULT_MARGIN_CONFIG,
  } = params;

  const eWinner = expectedScore(winner.currentRating, loser.currentRating);
  const eLoser = 1 - eWinner;

  let winnerKFactor = getKFactor(winner, winnerPercentile, kFactorConfig);
  let loserKFactor = getKFactor(loser, loserPercentile, kFactorConfig);

  if (isRepeatedOpponentWithinWindow) {
    winnerKFactor *= REPEATED_OPPONENT_DAMPING_FACTOR;
    loserKFactor *= REPEATED_OPPONENT_DAMPING_FACTOR;
  }

  // ELO_Algoritme.md §2bis: de multiplier schaalt K voor BEIDE duo's
  // gelijk — zelfde marge, zelfde weging; S blijft 1/0.
  const multiplier = games ? marginMultiplier(gameMargin(games.winner, games.loser), marginConfig) : 1;
  winnerKFactor *= multiplier;
  loserKFactor *= multiplier;

  const winnerDelta = Math.max(
    MIN_ABS_DELTA,
    roundHalfAwayFromZero(clamp(winnerKFactor * (1 - eWinner), ratingCap)),
  );
  const loserDelta = Math.min(
    -MIN_ABS_DELTA,
    roundHalfAwayFromZero(clamp(loserKFactor * (0 - eLoser), ratingCap)),
  );

  return {
    winnerNewRating: Math.max(0, Math.round(winner.currentRating + winnerDelta)),
    loserNewRating: Math.max(0, Math.round(loser.currentRating + loserDelta)),
    winnerKFactor,
    loserKFactor,
    marginMultiplier: multiplier,
  };
}
