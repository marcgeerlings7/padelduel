/**
 * Pure logica voor de uitslagsoorten in de UI (geen React): de keuze
 * Gespeeld / Walkover / Opgave, de opgave-invoer (onvolledige sets + wie
 * opgaf) en de weergave van een walkover/opgave op kaarten. De regels zelf
 * komen uit src/lib/match/resultType.ts — dezelfde validatie als de server.
 */
import { InvalidScoreError, type SetScore } from "@/lib/match/score";
import { completeRetiredScore, type MatchSideName } from "@/lib/match/resultType";
import type { PerspectiveSet } from "@/lib/stats/types";
import { parseGames, perspectiveSets, type Role, type SetDraft } from "./score-entry";

export type ResultChoice = "played" | "walkover" | "retired";

export const RESULT_CHOICES: ReadonlyArray<{ value: ResultChoice; label: string; hint: string }> = [
  { value: "played", label: "Gespeeld", hint: "De wedstrijd is uitgespeeld." },
  { value: "walkover", label: "Walkover", hint: "De tegenstander kwam niet opdagen." },
  { value: "retired", label: "Opgave", hint: "Een duo gaf op tijdens de wedstrijd." },
];

/** Wie gaf op, vanuit het eigen perspectief. */
export type RetiredBy = "own" | "opponent";

export const MAX_RETIRED_SETS = 3;

/** API-kant (uitdager/uitgedaagde) van het eigen duo of de tegenstander. */
export function sideOf(who: RetiredBy, role: Role): MatchSideName {
  if (who === "own") return role;
  return role === "challenger" ? "challenged" : "challenger";
}

export type RetirementPreview =
  | {
      ok: true;
      /** Gespeelde (onvolledige) sets in API-vorm, voor de indiening. */
      apiSets: SetScore[];
      retiredSide: MatchSideName;
      /** Voltooide uitslag vanuit het eigen perspectief (zoals hij telt). */
      completed: PerspectiveSet[];
    }
  | {
      ok: false;
      /** null = nog niet alles ingevuld (geen fout tonen). */
      error: string | null;
    };

/**
 * Valideert de opgave-invoer met exact de serverregels
 * (completeRetiredScore) en geeft de voltooide uitslag terug zoals die
 * voor de ELO telt.
 */
export function previewRetirement(drafts: SetDraft[], retiredBy: RetiredBy | null, role: Role): RetirementPreview {
  const apiSets: SetScore[] = [];
  for (const draft of drafts) {
    const own = parseGames(draft.own);
    const opponent = parseGames(draft.opponent);
    if (own === null || opponent === null) return { ok: false, error: null };
    apiSets.push(
      role === "challenger"
        ? { challengerGames: own, challengedGames: opponent }
        : { challengerGames: opponent, challengedGames: own },
    );
  }
  if (apiSets.length === 0 || !retiredBy) return { ok: false, error: null };
  const retiredSide = sideOf(retiredBy, role);
  try {
    const completed = completeRetiredScore(apiSets, retiredSide);
    return {
      ok: true,
      apiSets,
      retiredSide,
      completed: completed.map((set) => ({
        own: role === "challenger" ? set.challengerGames : set.challengedGames,
        opponent: role === "challenger" ? set.challengedGames : set.challengerGames,
        isMatchTiebreak: false,
      })),
    };
  } catch (err) {
    if (err instanceof InvalidScoreError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Velden van een match die de uitslagsoort beschrijven (API-vorm, Prisma-enumnamen). */
export type MatchResultInfo = {
  resultType?: "PLAYED" | "WALKOVER" | "RETIRED" | string | null;
  concedingSide?: "CHALLENGER" | "CHALLENGED" | string | null;
  playedScoreRaw?: string | null;
};

export type ResultTypeNote = {
  /** Korte badge-tekst. */
  label: "Walkover" | "Opgave";
  /** Uitleg in één zin, vanuit het eigen duo. */
  description: string;
  /** Opgave: de werkelijk gespeelde stand vanuit het eigen duo. */
  playedSets: PerspectiveSet[] | null;
};

/**
 * Uitleg bij een walkover/opgave vanuit het perspectief van `role`, of null
 * bij een gewone uitslag.
 */
export function resultTypeNote(match: MatchResultInfo, role: Role, opponentName: string): ResultTypeNote | null {
  const conceding = match.concedingSide === "CHALLENGER" ? "challenger" : match.concedingSide === "CHALLENGED" ? "challenged" : null;
  const ownConceded = conceding === role;
  if (match.resultType === "WALKOVER") {
    return {
      label: "Walkover",
      description: ownConceded
        ? "Walkover: jullie waren er niet. Telt als 0-6 0-6."
        : `Walkover: ${opponentName} kwam niet opdagen. Telt als 6-0 6-0.`,
      playedSets: null,
    };
  }
  if (match.resultType === "RETIRED") {
    const playedSets = match.playedScoreRaw ? perspectiveSets(match.playedScoreRaw, role) : [];
    const stand = playedSets.length > 0 ? ` bij ${playedSets.map((s) => `${s.own}-${s.opponent}`).join(" ")}` : "";
    return {
      label: "Opgave",
      description: ownConceded
        ? `Opgave door jullie${stand}. De rest van de wedstrijd telt als verloren.`
        : `Opgave door ${opponentName}${stand}. De rest van de wedstrijd telt als gewonnen.`,
      playedSets: playedSets.length > 0 ? playedSets : null,
    };
  }
  return null;
}

/** Nederlandse melding bij een mislukte score-indiening, op foutcode. */
export function scoreErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "ambiguous_duo":
      return "Je zit in beide duo's, dus een walkover kan niet eenduidig worden toegekend. Laat een speler die maar in één van beide duo's zit hem melden.";
    case "match_deadline_passed":
      return "De speeltermijn is verstreken; je kunt geen uitslag meer invullen.";
    case "score_already_submitted":
      return "Er is al een uitslag ingevuld voor deze challenge. Ververs de pagina.";
    case "challenge_not_accepted":
      return "Deze challenge staat niet (meer) open voor een uitslag. Ververs de pagina.";
    case "not_a_member":
      return "Je bent geen lid van een van beide duo's.";
    default:
      return fallback;
  }
}
