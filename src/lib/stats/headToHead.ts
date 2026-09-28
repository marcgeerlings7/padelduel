import { compareMatchesChronologically, matchFromPerspective } from "./record";
import { CompletedMatchRow, PerspectiveSet } from "./types";

export type HeadToHeadMeeting = {
  matchId: string;
  challengeId: string;
  date: Date;
  confirmedAt: Date | null;
  /** Vanuit het eerste duo (`duoId`). */
  result: "W" | "L";
  role: "challenger" | "challenged";
  score: string;
  sets: PerspectiveSet[];
  ratingDelta: number | null;
  opponentRatingDelta: number | null;
};

export type HeadToHeadSummary = {
  matches: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  setDifference: number;
  gameDifference: number;
  /** Nieuwste eerst. */
  meetings: HeadToHeadMeeting[];
};

export type MatchRatingRow = { duoId: string; matchId: string; ratingBefore: number; ratingAfter: number };

/**
 * Onderling resultaat van `duoId` tegen `otherDuoId`, uitsluitend over
 * BEVESTIGDE matches tussen precies deze twee duo's (in beide richtingen
 * uitgedaagd). Forfeits zijn geen ontmoetingen en tellen niet mee.
 */
export function computeHeadToHead(
  duoId: string,
  otherDuoId: string,
  matches: CompletedMatchRow[],
  ratingRows: MatchRatingRow[],
): HeadToHeadSummary {
  const delta = new Map<string, number>();
  for (const r of ratingRows) {
    const key = `${r.duoId}:${r.matchId}`;
    delta.set(key, (delta.get(key) ?? 0) + (r.ratingAfter - r.ratingBefore));
  }

  const summary: HeadToHeadSummary = {
    matches: 0,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
    setDifference: 0,
    gameDifference: 0,
    meetings: [],
  };

  const ordered = [...matches].sort(compareMatchesChronologically).reverse();
  for (const m of ordered) {
    const p = matchFromPerspective(m, duoId);
    if (!p || p.opponentDuoId !== otherDuoId) continue;
    summary.matches++;
    if (p.won) summary.wins++;
    else summary.losses++;
    summary.setsWon += p.setsWon;
    summary.setsLost += p.setsLost;
    summary.gamesWon += p.gamesWon;
    summary.gamesLost += p.gamesLost;
    summary.meetings.push({
      matchId: m.matchId,
      challengeId: m.challengeId,
      date: m.submittedAt,
      confirmedAt: m.confirmedAt,
      result: p.won ? "W" : "L",
      role: p.role,
      score: p.score,
      sets: p.sets,
      ratingDelta: delta.get(`${duoId}:${m.matchId}`) ?? null,
      opponentRatingDelta: delta.get(`${otherDuoId}:${m.matchId}`) ?? null,
    });
  }
  summary.setDifference = summary.setsWon - summary.setsLost;
  summary.gameDifference = summary.gamesWon - summary.gamesLost;
  return summary;
}
