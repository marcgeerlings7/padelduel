/**
 * Afgeleide duo-statistieken (KNLTB-aanvullingen, akkoord PO 2026-09-28).
 * Niets hiervan wordt opgeslagen — alles wordt per request berekend uit
 * match/challenge/rating_history (zelfde principe als ladderpositie en
 * tier, zie CLAUDE.md). Deze module is puur (geen DB), zodat de regels los
 * getest kunnen worden; statsService levert de ruwe rijen aan.
 */

export type DuoRef = { id: string; name: string };

/** Eén bevestigde (status COMPLETED) match, zoals uit de database gelezen. */
export type CompletedMatchRow = {
  matchId: string;
  challengeId: string;
  challengerDuoId: string;
  challengedDuoId: string;
  scoreRaw: string;
  /** Moment van score-indiening — de beste benadering van de speeldatum. */
  submittedAt: Date;
  confirmedAt: Date | null;
};

export type StreakDetail = { result: "W" | "L"; length: number };

export type DuoRecord = {
  wins: number;
  losses: number;
  /** "W3" / "L2", of "—" zonder bevestigde matches (bestaand ladder-contract). */
  streak: string;
  streakDetail: StreakDetail | null;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  setDifference: number;
  gameDifference: number;
  /** Meest recente confirmedAt van een bevestigde match (null als er geen is). */
  lastConfirmedMatchAt: Date | null;
};

export type Reliability = {
  /** Challenges die in een bevestigde match eindigden. */
  played: number;
  /** played + aan dit duo toe te rekenen forfeits (zie computeReliability). */
  total: number;
  /** played / total in hele procenten, null als total = 0. */
  percentage: number | null;
};

export type DuoStats = DuoRecord & {
  reliability: Reliability;
  inactive: boolean;
  lastActivityAt: Date;
};

/** Een set vanuit het perspectief van één duo. */
export type PerspectiveSet = { own: number; opponent: number; isMatchTiebreak: boolean };

/**
 * De compacte statistiekvelden die ladder- en dashboard-rijen (additief)
 * meekrijgen. De volledige DuoStats (incl. gewonnen/verloren sets en
 * games) staat in de `summary` van GET /api/duos/[id]/matches.
 */
export type DuoStatsSummary = Pick<
  DuoStats,
  | "wins"
  | "losses"
  | "streak"
  | "streakDetail"
  | "setDifference"
  | "gameDifference"
  | "reliability"
  | "inactive"
  | "lastActivityAt"
>;

/** Kopieert alleen de summary-velden (geen id/positie e.d. van een bredere rij). */
export function toDuoStatsSummary(stats: DuoStatsSummary): DuoStatsSummary {
  return {
    wins: stats.wins,
    losses: stats.losses,
    streak: stats.streak,
    streakDetail: stats.streakDetail,
    setDifference: stats.setDifference,
    gameDifference: stats.gameDifference,
    reliability: stats.reliability,
    inactive: stats.inactive,
    lastActivityAt: stats.lastActivityAt,
  };
}
