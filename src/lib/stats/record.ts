import {
  determineWinner,
  isMatchTiebreak,
  parseScore,
  serializeScore,
  summarizeScore,
  SetScore,
} from "@/lib/match/score";
import { CompletedMatchRow, DuoRecord, PerspectiveSet, StreakDetail } from "./types";

/** Uitslag van één bevestigde match vanuit het perspectief van `duoId`. */
export type MatchPerspective = {
  won: boolean;
  role: "challenger" | "challenged";
  opponentDuoId: string;
  sets: PerspectiveSet[];
  /** Score vanuit dit duo, zelfde formaat als score_raw ("6-4,3-6,10-8"). */
  score: string;
  setsWon: number;
  setsLost: number;
  /** KNLTB-telling: een match-tiebreak telt als 1-0 (zie summarizeScore). */
  gamesWon: number;
  gamesLost: number;
};

/**
 * Leest een opgeslagen uitslag vanuit één duo. Geeft null als het duo niet
 * bij de match betrokken is of de score onleesbaar is (score_raw wordt bij
 * indiening gevalideerd, dus dat laatste is alleen een vangnet: één corrupte
 * rij mag de ladder niet laten crashen).
 */
export function matchFromPerspective(match: CompletedMatchRow, duoId: string): MatchPerspective | null {
  const isChallenger = match.challengerDuoId === duoId;
  if (!isChallenger && match.challengedDuoId !== duoId) return null;

  let sets: SetScore[];
  try {
    sets = parseScore(match.scoreRaw);
  } catch {
    return null;
  }
  if (sets.length === 0) return null;

  const winner = determineWinner(sets);
  const summary = summarizeScore(sets);
  const perspectiveSets: PerspectiveSet[] = sets.map((s) => ({
    own: isChallenger ? s.challengerGames : s.challengedGames,
    opponent: isChallenger ? s.challengedGames : s.challengerGames,
    isMatchTiebreak: isMatchTiebreak(s),
  }));

  return {
    won: (winner === "challenger") === isChallenger,
    role: isChallenger ? "challenger" : "challenged",
    opponentDuoId: isChallenger ? match.challengedDuoId : match.challengerDuoId,
    sets: perspectiveSets,
    score: serializeScore(perspectiveSets.map((s) => ({ challengerGames: s.own, challengedGames: s.opponent }))),
    setsWon: isChallenger ? summary.challengerSets : summary.challengedSets,
    setsLost: isChallenger ? summary.challengedSets : summary.challengerSets,
    gamesWon: isChallenger ? summary.challengerGames : summary.challengedGames,
    gamesLost: isChallenger ? summary.challengedGames : summary.challengerGames,
  };
}

/**
 * Chronologische volgorde van gespeelde matches: op indieningsmoment
 * (≈ speeldatum), bij gelijke tijd op matchId voor een deterministische
 * uitkomst. Niet op confirmedAt: auto-confirm/dispute-afhandeling kan de
 * bevestiging dagen later laten vallen dan het spelen.
 */
export function compareMatchesChronologically(a: CompletedMatchRow, b: CompletedMatchRow): number {
  const diff = a.submittedAt.getTime() - b.submittedAt.getTime();
  if (diff !== 0) return diff;
  return a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0;
}

export function formatStreak(detail: StreakDetail | null): string {
  return detail ? `${detail.result}${detail.length}` : "—";
}

/** Huidige reeks: het aantal opeenvolgende gelijke uitslagen vanaf de laatste match. */
export function computeStreak(resultsChronological: boolean[]): StreakDetail | null {
  if (resultsChronological.length === 0) return null;
  const last = resultsChronological[resultsChronological.length - 1];
  let length = 0;
  for (let i = resultsChronological.length - 1; i >= 0 && resultsChronological[i] === last; i--) {
    length++;
  }
  return { result: last ? "W" : "L", length };
}

/**
 * W-L, reeks en set-/gamesaldo van één duo. Alleen BEVESTIGDE matches
 * tellen; forfeits (expired/unplayed_timeout) zijn geen gespeelde
 * wedstrijden en tellen hier niet mee — die komen terug in de
 * betrouwbaarheid (computeReliability). Een walkover/opgave die als
 * (synthetische) score is vastgelegd, is wél een bevestigde match en telt
 * dus gewoon mee.
 */
export function computeDuoRecord(duoId: string, matches: CompletedMatchRow[]): DuoRecord {
  const ordered = [...matches].sort(compareMatchesChronologically);
  const results: boolean[] = [];
  const record: DuoRecord = {
    wins: 0,
    losses: 0,
    streak: "—",
    streakDetail: null,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
    setDifference: 0,
    gameDifference: 0,
    lastConfirmedMatchAt: null,
  };

  for (const match of ordered) {
    const p = matchFromPerspective(match, duoId);
    if (!p) continue;
    results.push(p.won);
    if (p.won) record.wins++;
    else record.losses++;
    record.setsWon += p.setsWon;
    record.setsLost += p.setsLost;
    record.gamesWon += p.gamesWon;
    record.gamesLost += p.gamesLost;
    if (match.confirmedAt && (!record.lastConfirmedMatchAt || match.confirmedAt > record.lastConfirmedMatchAt)) {
      record.lastConfirmedMatchAt = match.confirmedAt;
    }
  }

  record.streakDetail = computeStreak(results);
  record.streak = formatStreak(record.streakDetail);
  record.setDifference = record.setsWon - record.setsLost;
  record.gameDifference = record.gamesWon - record.gamesLost;
  return record;
}

/** Groepeert matches per betrokken duo (voor ladder-brede berekening zonder N+1). */
export function groupMatchesByDuo(
  matches: CompletedMatchRow[],
  duoIds: Iterable<string>,
): Map<string, CompletedMatchRow[]> {
  const byDuo = new Map<string, CompletedMatchRow[]>();
  for (const id of duoIds) byDuo.set(id, []);
  for (const match of matches) {
    byDuo.get(match.challengerDuoId)?.push(match);
    byDuo.get(match.challengedDuoId)?.push(match);
  }
  return byDuo;
}
