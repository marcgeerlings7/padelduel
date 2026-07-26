import { Duo, KFactorConfig, DEFAULT_K_FACTOR_CONFIG } from "./types";
import { expectedScore } from "./expectedScore";
import { getKFactor } from "./kFactor";

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
};

export type ApplyMatchResultOutcome = {
  winnerNewRating: number;
  loserNewRating: number;
  winnerKFactor: number;
  loserKFactor: number;
};

function clamp(delta: number, cap: number): number {
  return Math.max(-cap, Math.min(cap, delta));
}

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
  } = params;

  const eWinner = expectedScore(winner.currentRating, loser.currentRating);
  const eLoser = 1 - eWinner;

  let winnerKFactor = getKFactor(winner, winnerPercentile, kFactorConfig);
  let loserKFactor = getKFactor(loser, loserPercentile, kFactorConfig);

  if (isRepeatedOpponentWithinWindow) {
    winnerKFactor *= REPEATED_OPPONENT_DAMPING_FACTOR;
    loserKFactor *= REPEATED_OPPONENT_DAMPING_FACTOR;
  }

  const winnerDelta = clamp(winnerKFactor * (1 - eWinner), ratingCap);
  const loserDelta = clamp(loserKFactor * (0 - eLoser), ratingCap);

  return {
    winnerNewRating: Math.max(0, Math.round(winner.currentRating + winnerDelta)),
    loserNewRating: Math.max(0, Math.round(loser.currentRating + loserDelta)),
    winnerKFactor,
    loserKFactor,
  };
}
