import { matchFromPerspective } from "./record";
import { CompletedMatchRow, DuoRef, PerspectiveSet } from "./types";

export type HistoryMatchRow = {
  matchId: string;
  challengeId: string;
  status: "COMPLETED" | "VOIDED";
  challengerDuo: DuoRef;
  challengedDuo: DuoRef;
  scoreRaw: string;
  submittedAt: Date;
  confirmedAt: Date | null;
  /** KNLTB-aanvullingen; ontbreekt/undefined = gewone gespeelde uitslag. */
  resultType?: "PLAYED" | "WALKOVER" | "RETIRED";
  concedingSide?: "CHALLENGER" | "CHALLENGED" | null;
  /** Werkelijk gespeelde (onvolledige) stand bij een opgave, uitdager eerst. */
  playedScoreRaw?: string | null;
};

export type HistoryRatingRow = {
  matchId: string | null;
  challengeId: string | null;
  ratingBefore: number;
  ratingAfter: number;
  isForfeit: boolean;
  createdAt: Date;
  /** Alleen gevuld voor challenge-gebonden (forfeit-)rijen. */
  challenge: {
    id: string;
    status: string;
    challengerDuo: DuoRef;
    challengedDuo: DuoRef;
  } | null;
};

export type MatchHistoryKind = "match" | "voided" | "forfeit";
export type HistoryResultType = "played" | "walkover" | "retired";
export type ForfeitReason = "expired" | "unplayed_timeout";

export type MatchHistoryEntry = {
  kind: MatchHistoryKind;
  matchId: string | null;
  challengeId: string;
  /** match/voided: indieningsmoment (≈ speeldatum); forfeit: moment van de penalty. */
  date: Date;
  confirmedAt: Date | null;
  opponent: DuoRef;
  role: "challenger" | "challenged";
  /** Alleen bij kind "match"; voided/forfeit hebben geen uitslag. */
  result: "W" | "L" | null;
  /** Score vanuit dit duo ("6-4,3-6,10-8"); null bij forfeit. */
  score: string | null;
  sets: PerspectiveSet[] | null;
  setsWon: number | null;
  setsLost: number | null;
  gamesWon: number | null;
  gamesLost: number | null;
  /**
   * Netto rating-effect voor dit duo: de SOM van alle rating_history-rijen
   * van deze match/challenge (een forfeit kan een penalty + een
   * correctie-record hebben). 0 bij voided; null als er (onverwacht) geen
   * rijen zijn bij een bevestigde match.
   */
  ratingDelta: number | null;
  isForfeit: boolean;
  forfeitReason: ForfeitReason | null;
  /** Forfeit-penalty later (deels) teruggedraaid via een dispute-correctie. */
  forfeitCorrected: boolean;
  /** match/voided: soort uitslag (walkover/opgave, KNLTB); null bij forfeit. */
  resultType: HistoryResultType | null;
  /**
   * Walkover/opgave: welke kant niet kwam of opgaf, vanuit dit duo
   * ("self" = dit duo). null bij een gewone uitslag of forfeit.
   */
  concededBy: "self" | "opponent" | null;
  /** Opgave: werkelijk gespeelde stand vanuit dit duo ("6-4,3-2"); anders null. */
  playedScore: string | null;
};

const RESULT_TYPE_NAME: Record<NonNullable<HistoryMatchRow["resultType"]>, HistoryResultType> = {
  PLAYED: "played",
  WALKOVER: "walkover",
  RETIRED: "retired",
};

/** "6-4,3-2" (uitdager eerst) → vanuit `role`; ongeldige invoer → null. */
export function perspectiveScoreRaw(scoreRaw: string, role: "challenger" | "challenged"): string | null {
  const parts = scoreRaw.split(",").map((part) => /^(\d+)-(\d+)$/.exec(part.trim()));
  if (parts.some((m) => !m)) return null;
  return parts
    .map((m) => (role === "challenger" ? `${m![1]}-${m![2]}` : `${m![2]}-${m![1]}`))
    .join(",");
}

function forfeitReasonFor(status: string): ForfeitReason | null {
  if (status === "EXPIRED") return "expired";
  if (status === "UNPLAYED_TIMEOUT") return "unplayed_timeout";
  return null;
}

/**
 * Bouwt de wedstrijdhistorie van één duo (nieuwste eerst): bevestigde
 * matches, ongeldig verklaarde (voided) matches en forfeits. Nog lopende
 * matches (awaiting_confirmation/disputed) horen niet in de historie.
 */
export function buildMatchHistory(
  duoId: string,
  matches: HistoryMatchRow[],
  ratingRows: HistoryRatingRow[],
): MatchHistoryEntry[] {
  const deltaByMatch = new Map<string, number>();
  const forfeitRowsByChallenge = new Map<string, HistoryRatingRow[]>();
  for (const row of ratingRows) {
    const delta = row.ratingAfter - row.ratingBefore;
    if (row.matchId) {
      deltaByMatch.set(row.matchId, (deltaByMatch.get(row.matchId) ?? 0) + delta);
    } else if (row.challengeId && row.challenge) {
      const rows = forfeitRowsByChallenge.get(row.challengeId) ?? [];
      rows.push(row);
      forfeitRowsByChallenge.set(row.challengeId, rows);
    }
  }

  const entries: MatchHistoryEntry[] = [];

  for (const m of matches) {
    const isChallenger = m.challengerDuo.id === duoId;
    if (!isChallenger && m.challengedDuo.id !== duoId) continue;
    const row: CompletedMatchRow = {
      matchId: m.matchId,
      challengeId: m.challengeId,
      challengerDuoId: m.challengerDuo.id,
      challengedDuoId: m.challengedDuo.id,
      scoreRaw: m.scoreRaw,
      submittedAt: m.submittedAt,
      confirmedAt: m.confirmedAt,
    };
    const p = matchFromPerspective(row, duoId);
    const isVoided = m.status === "VOIDED";
    const role = isChallenger ? "challenger" : "challenged";
    const concedingRole = m.concedingSide ? (m.concedingSide === "CHALLENGER" ? "challenger" : "challenged") : null;
    entries.push({
      kind: isVoided ? "voided" : "match",
      matchId: m.matchId,
      challengeId: m.challengeId,
      date: m.submittedAt,
      confirmedAt: m.confirmedAt,
      opponent: isChallenger ? m.challengedDuo : m.challengerDuo,
      role: isChallenger ? "challenger" : "challenged",
      result: isVoided || !p ? null : p.won ? "W" : "L",
      score: p?.score ?? null,
      sets: p?.sets ?? null,
      setsWon: p?.setsWon ?? null,
      setsLost: p?.setsLost ?? null,
      gamesWon: p?.gamesWon ?? null,
      gamesLost: p?.gamesLost ?? null,
      ratingDelta: isVoided ? 0 : (deltaByMatch.get(m.matchId) ?? null),
      isForfeit: false,
      forfeitReason: null,
      forfeitCorrected: false,
      resultType: RESULT_TYPE_NAME[m.resultType ?? "PLAYED"],
      concededBy: concedingRole ? (concedingRole === role ? "self" : "opponent") : null,
      playedScore: m.playedScoreRaw ? perspectiveScoreRaw(m.playedScoreRaw, role) : null,
    });
  }

  for (const [challengeId, rows] of forfeitRowsByChallenge) {
    const challenge = rows[0].challenge!;
    const isChallenger = challenge.challengerDuo.id === duoId;
    const firstAt = rows.reduce((min, r) => (r.createdAt < min ? r.createdAt : min), rows[0].createdAt);
    entries.push({
      kind: "forfeit",
      matchId: null,
      challengeId,
      date: firstAt,
      confirmedAt: null,
      opponent: isChallenger ? challenge.challengedDuo : challenge.challengerDuo,
      role: isChallenger ? "challenger" : "challenged",
      result: null,
      score: null,
      sets: null,
      setsWon: null,
      setsLost: null,
      gamesWon: null,
      gamesLost: null,
      ratingDelta: rows.reduce((sum, r) => sum + (r.ratingAfter - r.ratingBefore), 0),
      isForfeit: true,
      forfeitReason: forfeitReasonFor(challenge.status),
      forfeitCorrected: rows.some((r) => r.isForfeit && r.ratingAfter > r.ratingBefore),
      resultType: null,
      concededBy: null,
      playedScore: null,
    });
  }

  // Nieuwste eerst; bij gelijke datum deterministisch op id.
  return entries.sort((a, b) => {
    const diff = b.date.getTime() - a.date.getTime();
    if (diff !== 0) return diff;
    const ka = a.matchId ?? a.challengeId;
    const kb = b.matchId ?? b.challengeId;
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });
}
