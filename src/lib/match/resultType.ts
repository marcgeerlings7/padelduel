/**
 * Uitslagsoorten (KNLTB-aanvullingen, akkoord PO 2026-09-28; KNLTB CRP
 * art. 35.4 en 52.3). Pure functies, DB-onafhankelijk.
 *
 * - played   : gewone, volledig gespeelde uitslag (bestaand gedrag).
 * - walkover : de tegenpartij kwam niet opdagen of gaf op vóór aanvang.
 *              Telt als 6-0 6-0 voor het duo dat wél kwam (KNLTB) en loopt
 *              via de GEWONE ELO-verwerking — dit is uitdrukkelijk GEEN
 *              is_forfeit-penalty (die is voorbehouden aan expired/
 *              unplayed_timeout, zie ELO_Algoritme.md §8bis).
 * - retired  : opgave tijdens de wedstrijd. De gespeelde games blijven
 *              staan; de lopende set wordt met de kleinst mogelijke
 *              geldige eindstand uitgespeeld door de NIET-opgevende kant
 *              (6-x, 7-5 of 7-6) en elke resterende set telt als 6-0.
 *              Eveneens via de gewone ELO-verwerking.
 *
 * In alle gevallen is `scoreRaw` de VOLTOOIDE uitslag (waarmee ELO en
 * afgeleide statistieken rekenen); bij retired wordt de werkelijk
 * gespeelde stand apart bewaard in `playedScoreRaw`.
 */
import {
  InvalidScoreError,
  serializeScore,
  validateSet,
  validateSets,
  type SetScore,
} from "@/lib/match/score";

export type MatchSideName = "challenger" | "challenged";
export type MatchResultTypeName = "played" | "walkover" | "retired";

export type ScoreSubmission =
  | { resultType: "played"; sets: SetScore[] }
  | { resultType: "walkover"; concedingSide: MatchSideName }
  | { resultType: "retired"; sets: SetScore[]; retiredSide: MatchSideName };

export type ResolvedMatchResult = {
  resultType: MatchResultTypeName;
  /** Voltooide uitslag (grondslag voor ELO), geserialiseerd. */
  scoreRaw: string;
  /** Voltooide uitslag als sets. */
  sets: SetScore[];
  /** Kant die niet kwam (walkover) of opgaf (retired); null bij played. */
  concedingSide: MatchSideName | null;
  /** Werkelijk gespeelde (onvolledige) stand; alleen bij retired. */
  playedScoreRaw: string | null;
};

export const WALKOVER_SET_COUNT = 2;
const SETS_TO_WIN = 2;
const MAX_SETS = 3;

/** Games vanuit het perspectief van de niet-opgevende (w) en opgevende (r) kant. */
type OrientedSet = { w: number; r: number };

function orient(set: SetScore, concedingSide: MatchSideName): OrientedSet {
  return concedingSide === "challenger"
    ? { w: set.challengedGames, r: set.challengerGames }
    : { w: set.challengerGames, r: set.challengedGames };
}

function unorient({ w, r }: OrientedSet, concedingSide: MatchSideName): SetScore {
  return concedingSide === "challenger"
    ? { challengerGames: r, challengedGames: w }
    : { challengerGames: w, challengedGames: r };
}

function isFinishedSet(set: SetScore): boolean {
  try {
    validateSet(set);
    return set.challengerGames !== set.challengedGames;
  } catch {
    return false;
  }
}

/**
 * Een lopende (onafgemaakte) gewone set: beide kanten 0-6 games en nog
 * geen geldige eindstand (dus niet 6-0 t/m 6-4). Omvat 5-5, 6-5 en 6-6
 * (tiebreak bezig). Een lopende (super-)tiebreak wordt als games van de
 * set ingevoerd — de tiebreakpunten zelf tellen niet (zie Technical_Debt).
 */
function isInProgressSet({ challengerGames: a, challengedGames: b }: SetScore): boolean {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if (a < 0 || b < 0 || high > 6) return false;
  return !(high === 6 && low <= 4);
}

/** Maakt een lopende set af in het voordeel van de niet-opgevende kant. */
export function completeInProgressSet({ w, r }: OrientedSet): OrientedSet {
  if (r <= 4) return { w: 6, r };
  if (r === 5) return { w: 7, r: 5 };
  return { w: 7, r: 6 };
}

export function completeRetiredScore(partialSets: SetScore[], retiredSide: MatchSideName): SetScore[] {
  if (partialSets.length < 1 || partialSets.length > MAX_SETS) {
    throw new InvalidScoreError("Geef bij een opgave 1 tot 3 sets op (de laatste mag onafgemaakt zijn).");
  }
  for (const set of partialSets) {
    if (
      !Number.isInteger(set.challengerGames) ||
      !Number.isInteger(set.challengedGames) ||
      set.challengerGames < 0 ||
      set.challengedGames < 0
    ) {
      throw new InvalidScoreError("Games per set moeten gehele, niet-negatieve getallen zijn.");
    }
  }

  const completed: OrientedSet[] = [];
  let wSets = 0;
  let rSets = 0;

  partialSets.forEach((set, index) => {
    const isLast = index === partialSets.length - 1;
    const label = `${set.challengerGames}-${set.challengedGames}`;

    if (wSets >= SETS_TO_WIN || rSets >= SETS_TO_WIN) {
      throw new InvalidScoreError("De wedstrijd was al beslist vóór deze set; dien een gewone uitslag in.");
    }

    if (isFinishedSet(set)) {
      const o = orient(set, retiredSide);
      completed.push(o);
      if (o.w > o.r) wSets++;
      else rSets++;
      return;
    }

    if (!isLast) {
      throw new InvalidScoreError(
        `Set ${index + 1} (${label}) is geen geldige eindstand; alleen de laatste set mag onafgemaakt zijn.`,
      );
    }
    if (!isInProgressSet(set)) {
      throw new InvalidScoreError(
        `Ongeldige stand ${label} voor de lopende set: vul de games in (0-6 per kant, nog niet beslist).`,
      );
    }
    const finished = completeInProgressSet(orient(set, retiredSide));
    completed.push(finished);
    wSets++;
  });

  const lastWasFinished = isFinishedSet(partialSets[partialSets.length - 1]);
  if (rSets >= SETS_TO_WIN || (lastWasFinished && wSets >= SETS_TO_WIN)) {
    throw new InvalidScoreError(
      "De opgegeven sets vormen al een volledige uitslag; dien een gewone uitslag in.",
    );
  }

  while (wSets < SETS_TO_WIN) {
    completed.push({ w: 6, r: 0 });
    wSets++;
  }
  if (completed.length > MAX_SETS) {
    // Kan niet voorkomen gegeven de checks hierboven; vangnet.
    throw new InvalidScoreError("Een wedstrijd bestaat uit maximaal 3 sets.");
  }

  const result = completed.map((o) => unorient(o, retiredSide));
  validateSets(result); // vangnet: de voltooide uitslag moet altijd geldig zijn
  return result;
}

export function walkoverSets(concedingSide: MatchSideName): SetScore[] {
  return Array.from({ length: WALKOVER_SET_COUNT }, () => unorient({ w: 6, r: 0 }, concedingSide));
}

/**
 * Zet een indiening om naar de op te slaan uitslag. Gooit
 * InvalidScoreError bij een ongeldige (deel)score.
 */
export function resolveScoreSubmission(submission: ScoreSubmission): ResolvedMatchResult {
  switch (submission.resultType) {
    case "played": {
      validateSets(submission.sets);
      return {
        resultType: "played",
        scoreRaw: serializeScore(submission.sets),
        sets: submission.sets,
        concedingSide: null,
        playedScoreRaw: null,
      };
    }
    case "walkover": {
      const sets = walkoverSets(submission.concedingSide);
      return {
        resultType: "walkover",
        scoreRaw: serializeScore(sets),
        sets,
        concedingSide: submission.concedingSide,
        playedScoreRaw: null,
      };
    }
    case "retired": {
      const sets = completeRetiredScore(submission.sets, submission.retiredSide);
      return {
        resultType: "retired",
        scoreRaw: serializeScore(sets),
        sets,
        concedingSide: submission.retiredSide,
        playedScoreRaw: serializeScore(submission.sets),
      };
    }
  }
}
