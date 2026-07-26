export type Duo = {
  id: string;
  currentRating: number;
  matchesPlayed: number;
};

export type KFactorConfig = {
  provisionalMatchThreshold: number;
  provisionalK: number;
  establishedK: number;
  topK: number;
  topPercentileThreshold: number;
};

/**
 * Aanbevolen startwaarden uit ELO_Algoritme.md §3. Configureerbaar via de
 * `config`-parameter van getKFactor/applyMatchResult — deze module is
 * bewust DB-onafhankelijk, dus de daadwerkelijke platform_config-waarden
 * worden pas door de aanroeper (Sprint 3) ingevuld.
 */
export const DEFAULT_K_FACTOR_CONFIG: KFactorConfig = {
  provisionalMatchThreshold: 10,
  provisionalK: 40,
  establishedK: 24,
  topK: 16,
  topPercentileThreshold: 0.1,
};
