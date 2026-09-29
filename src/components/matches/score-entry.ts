/**
 * Pure logica achter het score-invoerformulier (geen React). Het formulier
 * werkt vanuit het eigen perspectief ("wij" links, tegenstander rechts); de
 * API verwacht sets in uitdager/uitgedaagde-volgorde. De setregels zelf
 * komen uit src/lib/match/score.ts (dezelfde validatie als de server).
 */
import {
  InvalidScoreError,
  isMatchTiebreak,
  parseScore,
  type SetScore,
  validateSets,
} from "@/lib/match/score";
import type { PerspectiveSet } from "@/lib/stats/types";

export type Role = "challenger" | "challenged";

/** Eén set zoals ingevoerd: ruwe tekst (leeg = nog niet ingevuld). */
export type SetDraft = { own: string; opponent: string };

/** Hoe een beslissende (derde) set gespeeld is. */
export type DeciderMode = "set" | "tiebreak";

/** Snelkeuzes voor een gewone set, vanuit de winnaar gezien. */
export const REGULAR_SET_PICKS: ReadonlyArray<readonly [number, number]> = [
  [6, 0],
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [7, 5],
  [7, 6],
];

export const MAX_GAMES = 99;

/** "6" → 6; leeg, negatief of geen geheel getal → null. */
export function parseGames(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  return Number(trimmed);
}

function toPerspective(draft: SetDraft): { own: number; opponent: number } | null {
  const own = parseGames(draft.own);
  const opponent = parseGames(draft.opponent);
  if (own === null || opponent === null) return null;
  return { own, opponent };
}

/**
 * Probleem met één volledig ingevulde set, of null als hij geldig is (of nog
 * niet volledig is ingevuld). Hergebruikt validateSets uit lib/match/score:
 * een set tweemaal aanbieden levert precies de setregel-fouten op, omdat twee
 * identieke geldige sets altijd een eenduidige winnaar geven.
 */
export function setProblem(draft: SetDraft, mode: DeciderMode = "set"): string | null {
  const set = toPerspective(draft);
  if (!set) return null;
  const score: SetScore = { challengerGames: set.own, challengedGames: set.opponent };
  const tiebreak = isMatchTiebreak(score);
  if (mode === "tiebreak" && !tiebreak && set.own !== set.opponent) {
    return "Een super-tiebreak gaat tot minstens 10 punten, met 2 punten verschil.";
  }
  if (mode === "set" && tiebreak) {
    return "Een gewone set eindigt uiterlijk op 7 games. Speelden jullie een super-tiebreak? Kies die hieronder.";
  }
  try {
    validateSets([score, score]);
    return null;
  } catch (err) {
    if (err instanceof InvalidScoreError) return err.message;
    throw err;
  }
}

/** Winnaar van een geldige set vanuit het eigen perspectief, anders null. */
export function setWinner(draft: SetDraft, mode: DeciderMode = "set"): "own" | "opponent" | null {
  const set = toPerspective(draft);
  if (!set || setProblem(draft, mode)) return null;
  return set.own > set.opponent ? "own" : "opponent";
}

/** Een beslissende set is nodig als de eerste twee (geldige) sets verdeeld zijn. */
export function needsDecider(first: SetDraft, second: SetDraft): boolean {
  const a = setWinner(first);
  const b = setWinner(second);
  return a !== null && b !== null && a !== b;
}

export type ScorePreview = {
  ownSets: number;
  opponentSets: number;
  winner: "own" | "opponent";
};

/**
 * Sets die daadwerkelijk ingediend worden: de eerste twee, plus de
 * beslissende set als die nodig is.
 */
export function activeDrafts(drafts: SetDraft[]): SetDraft[] {
  if (drafts.length < 2) return drafts;
  return needsDecider(drafts[0], drafts[1]) ? drafts.slice(0, 3) : drafts.slice(0, 2);
}

/** Uitslag-voorvertoning als alle actieve sets geldig zijn, anders null. */
export function previewScore(drafts: SetDraft[], deciderMode: DeciderMode): ScorePreview | null {
  const active = activeDrafts(drafts);
  if (active.length < 2) return null;
  let ownSets = 0;
  let opponentSets = 0;
  for (let i = 0; i < active.length; i++) {
    const winner = setWinner(active[i], i === 2 ? deciderMode : "set");
    if (!winner) return null;
    if (winner === "own") ownSets++;
    else opponentSets++;
  }
  if (ownSets === opponentSets) return null;
  return { ownSets, opponentSets, winner: ownSets > opponentSets ? "own" : "opponent" };
}

/**
 * Zet de eigen-perspectief-invoer om naar de API-vorm (uitdager/uitgedaagde).
 * Geeft null als een actieve set niet volledig is ingevuld.
 */
export function toApiSets(drafts: SetDraft[], role: Role): SetScore[] | null {
  const sets: SetScore[] = [];
  for (const draft of activeDrafts(drafts)) {
    const set = toPerspective(draft);
    if (!set) return null;
    sets.push(
      role === "challenger"
        ? { challengerGames: set.own, challengedGames: set.opponent }
        : { challengerGames: set.opponent, challengedGames: set.own },
    );
  }
  return sets;
}

/** Stapper: +1/−1 binnen [0, MAX_GAMES]; een lege waarde telt als 0. */
export function stepGames(value: string, delta: 1 | -1): string {
  const current = parseGames(value) ?? 0;
  const next = Math.min(MAX_GAMES, Math.max(0, current + delta));
  return String(next);
}

/**
 * Een opgeslagen score_raw ("6-4,3-6,10-8", uitdager eerst) vanuit het
 * perspectief van één duo. Ongeldige ruwe scores → lege lijst.
 */
export function perspectiveSets(scoreRaw: string, role: Role): PerspectiveSet[] {
  try {
    return parseScore(scoreRaw).map((set) => ({
      own: role === "challenger" ? set.challengerGames : set.challengedGames,
      opponent: role === "challenger" ? set.challengedGames : set.challengerGames,
      isMatchTiebreak: isMatchTiebreak(set),
    }));
  } catch {
    return [];
  }
}

/** "6-4, 3-6, 10-8" — leesbare scoreregel voor lopende tekst. */
export function formatSets(sets: PerspectiveSet[]): string {
  return sets.map((s) => `${s.own}-${s.opponent}`).join(", ");
}
