/**
 * ELO-gamesaldo (KNLTB-aanvulling, akkoord PO 2026-09-28) — zie
 * ELO_Algoritme.md §2bis.
 *
 * De klassieke ELO-formule kent alleen winst (S = 1) of verlies (S = 0).
 * De KNLTB telt sinds 2025 gewonnen/verloren games mee en Playtomic weegt
 * de marge; daarom schaalt een margin-of-victory-multiplier M de K-factor:
 *
 *   marge m = (G_w - G_l) / (G_w + G_l), begrensd tot [0, 1]
 *   M       = M_min + (M_max - M_min) * m
 *   Δ_w     = +K_w * M * (1 - E_w)
 *   Δ_l     = -K_l * M * E_l            (E_l = 1 - E_w)
 *
 * G_w/G_l zijn de games van winnaar/verliezer volgens de KNLTB-telling
 * (een match-tiebreak telt als 1-0, zie summarizeScore in
 * src/lib/match/score.ts). Waarom een multiplier op K en géén
 * marge-afhankelijke S in [0.5, 1]: met S < 1 zou een favoriet die nipt
 * wint (S = 0.55, E = 0.64) punten VERLIEZEN — de PO-eis is dat de winnaar
 * altijd wint en de verliezer altijd verliest. (1 - E_w) > 0 en E_l > 0,
 * dus met M > 0 is het teken van beide delta's altijd correct.
 *
 * Deze module blijft DB-onafhankelijk; de aanroeper leest de parameters
 * uit platform_config (met deze defaults als fallback).
 */

export type MarginConfig = {
  /** Multiplier bij de kleinst mogelijke marge (m = 0). Moet > 0 zijn. */
  minMultiplier: number;
  /** Multiplier bij de grootst mogelijke marge (m = 1, bijv. 6-0 6-0). */
  maxMultiplier: number;
};

/**
 * Defaults: 6-3 6-3 (m = 1/3) levert exact M = 1.0 op — de klassieke
 * ELO-uitkomst voor een "normale" overwinning. Een 7-6 6-7 10-8-thriller
 * (m ≈ 0.04) geeft M ≈ 0.78, een 6-0 6-0 M = 1.5.
 */
export const DEFAULT_MARGIN_CONFIG: MarginConfig = {
  minMultiplier: 0.75,
  maxMultiplier: 1.5,
};

/** platform_config-keys (rijen nog toe te voegen in een migratie, zie Technical_Debt.md). */
export const MARGIN_CONFIG_KEYS = {
  minMultiplier: "elo_margin_multiplier_min",
  maxMultiplier: "elo_margin_multiplier_max",
} as const;

export class InvalidMarginConfigError extends Error {}

/** Weigert configuraties die de "winnaar wint altijd"-garantie of monotonie breken. */
export function validateMarginConfig(config: MarginConfig): void {
  const { minMultiplier, maxMultiplier } = config;
  if (!Number.isFinite(minMultiplier) || !Number.isFinite(maxMultiplier)) {
    throw new InvalidMarginConfigError("Marge-multipliers moeten eindige getallen zijn.");
  }
  if (minMultiplier <= 0) {
    throw new InvalidMarginConfigError(
      `elo_margin_multiplier_min moet > 0 zijn (is ${minMultiplier}), anders kan een winnaar 0 punten krijgen.`,
    );
  }
  if (maxMultiplier < minMultiplier) {
    throw new InvalidMarginConfigError(
      `elo_margin_multiplier_max (${maxMultiplier}) moet >= elo_margin_multiplier_min (${minMultiplier}) zijn.`,
    );
  }
}

/**
 * Genormaliseerd gamesaldo vanuit de winnaar, in [0, 1]. Kan de winnaar
 * minder games hebben dan de verliezer (bijv. 0-6 7-6 10-8 → 8-12), dan is
 * de marge 0 — de winst zelf blijft volledig gelden, alleen zonder bonus.
 */
export function gameMargin(winnerGames: number, loserGames: number): number {
  if (!Number.isFinite(winnerGames) || !Number.isFinite(loserGames) || winnerGames < 0 || loserGames < 0) {
    throw new RangeError(`Ongeldige games: ${winnerGames}-${loserGames}`);
  }
  const total = winnerGames + loserGames;
  if (total === 0) return 0;
  return Math.min(1, Math.max(0, (winnerGames - loserGames) / total));
}

/** Lineaire, monotoon stijgende afbeelding van marge [0, 1] naar [M_min, M_max]. */
export function marginMultiplier(margin: number, config: MarginConfig = DEFAULT_MARGIN_CONFIG): number {
  validateMarginConfig(config);
  const m = Math.min(1, Math.max(0, margin));
  return config.minMultiplier + (config.maxMultiplier - config.minMultiplier) * m;
}
