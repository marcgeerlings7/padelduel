/**
 * Pure helpers voor de publieke pagina's (landing). Geen React, geen fetch —
 * zodat de regels los getest kunnen worden (tests/unit/ui/public-landing.test.ts).
 */
import { applyMatchResult, expectedScore } from "@/lib/elo";
import { summarizeScore, type SetScore } from "@/lib/match/score";

/* ── Rekenvoorbeeld ELO + gamesaldo ─────────────────────────────────────── */

export type DemoScoreline = { id: string; label: string; sets: SetScore[] };
export type DemoMatchup = {
  id: string;
  label: string;
  /** Rating van het duo dat in dit voorbeeld wint. */
  winnerRating: number;
  loserRating: number;
};

/** Uitslagen vanuit de winnaar (challenger = winnaar), zoals in ELO_Algoritme.md §2bis. */
export const DEMO_SCORELINES: readonly DemoScoreline[] = [
  { id: "60-60", label: "6-0 6-0", sets: [s(6, 0), s(6, 0)] },
  { id: "63-63", label: "6-3 6-3", sets: [s(6, 3), s(6, 3)] },
  { id: "64-64", label: "6-4 6-4", sets: [s(6, 4), s(6, 4)] },
  { id: "76-67-108", label: "7-6 6-7 10-8", sets: [s(7, 6), s(6, 7), s(10, 8)] },
];

export const DEMO_MATCHUPS: readonly DemoMatchup[] = [
  { id: "even", label: "Gelijkwaardig", winnerRating: 1200, loserRating: 1200 },
  { id: "favorite", label: "Favoriet wint", winnerRating: 1250, loserRating: 1180 },
  { id: "underdog", label: "Underdog wint", winnerRating: 1180, loserRating: 1250 },
];

function s(challengerGames: number, challengedGames: number): SetScore {
  return { challengerGames, challengedGames };
}

export type DemoOutcome = {
  winnerDelta: number;
  loserDelta: number;
  /** Verwachte winkans van de winnaar vóór de wedstrijd (0–1). */
  winnerExpected: number;
  /** Games volgens de KNLTB-telling (match-tiebreak = 1-0). */
  winnerGames: number;
  loserGames: number;
  marginMultiplier: number;
  /** Basis-K van een gevestigd duo (zonder demping/multiplier). */
  baseK: number;
};

/** Gevestigd duo buiten de top 10%: basis-K zoals in de echte verwerking. */
const ESTABLISHED = { matchesPlayed: 20, percentile: 0.5 } as const;

/**
 * Rekent een voorbeeldwedstrijd door met exact dezelfde functies als de
 * matchverwerking (applyMatchResult + summarizeScore), met de standaard-
 * instellingen — geen aparte "marketing"-formule die kan gaan afwijken.
 */
export function computeDemoOutcome(matchup: DemoMatchup, scoreline: DemoScoreline): DemoOutcome {
  const summary = summarizeScore(scoreline.sets);
  const winner = { id: "winnaar", currentRating: matchup.winnerRating, matchesPlayed: ESTABLISHED.matchesPlayed };
  const loser = { id: "verliezer", currentRating: matchup.loserRating, matchesPlayed: ESTABLISHED.matchesPlayed };
  const outcome = applyMatchResult({
    winner,
    loser,
    winnerPercentile: ESTABLISHED.percentile,
    loserPercentile: ESTABLISHED.percentile,
    games: { winner: summary.challengerGames, loser: summary.challengedGames },
  });
  const baseK = outcome.winnerKFactor / outcome.marginMultiplier;
  return {
    winnerDelta: outcome.winnerNewRating - matchup.winnerRating,
    loserDelta: outcome.loserNewRating - matchup.loserRating,
    winnerExpected: expectedScore(matchup.winnerRating, matchup.loserRating),
    winnerGames: summary.challengerGames,
    loserGames: summary.challengedGames,
    marginMultiplier: outcome.marginMultiplier,
    baseK: Math.round(baseK),
  };
}

/* ── Live ladder-voorproefje ────────────────────────────────────────────── */

export type PreviewEntry = {
  id: string;
  name: string;
  position: number;
  tier: number;
  currentRating: number;
  wins: number;
  losses: number;
  streak: string;
};

export type TierGroup<T extends PreviewEntry> = { tier: number; entries: T[] };

/**
 * De bovenste `limit` duo's, gegroepeerd per tier (in ladder-volgorde). Tier
 * komt uit de API — hier wordt niets herberekend.
 */
export function groupTopByTier<T extends PreviewEntry>(ladder: readonly T[], limit: number): TierGroup<T>[] {
  const top = [...ladder].sort((a, b) => a.position - b.position).slice(0, Math.max(0, limit));
  const groups: TierGroup<T>[] = [];
  for (const entry of top) {
    const last = groups[groups.length - 1];
    if (last && last.tier === entry.tier) last.entries.push(entry);
    else groups.push({ tier: entry.tier, entries: [entry] });
  }
  return groups;
}

/** "0,50" → Nederlandse notatie met vaste decimalen. */
export function formatDecimal(value: number, digits = 2): string {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(value);
}

/** 0.6 → "60%". */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
