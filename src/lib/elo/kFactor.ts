import { Duo, KFactorConfig, DEFAULT_K_FACTOR_CONFIG } from "./types";

/** ELO_Algoritme.md §3. */
export function getKFactor(
  duo: Duo,
  ladderPercentile: number,
  config: KFactorConfig = DEFAULT_K_FACTOR_CONFIG,
): number {
  if (duo.matchesPlayed < config.provisionalMatchThreshold) {
    return config.provisionalK;
  }
  if (ladderPercentile <= config.topPercentileThreshold) {
    return config.topK;
  }
  return config.establishedK;
}
