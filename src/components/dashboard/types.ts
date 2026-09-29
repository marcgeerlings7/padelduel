import type { LadderRow, Reliability, StreakDetail } from "@/components/ladder/ladder-model";

/** Vorm van GET /api/dashboard (zie dashboardService.DashboardDuoCard; JSON: datums als string). */
export type DashboardDuo = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
  currentRating: number;
  position: number;
  ladderSize: number;
  tier: number;
  partnerEmail: string | null;
  wins: number;
  losses: number;
  streak: string;
  streakDetail: StreakDetail | null;
  setDifference: number;
  gameDifference: number;
  reliability: Reliability;
  inactive: boolean;
  lastActivityAt: string;
};

export type DashboardDuoCard = { duo: DashboardDuo; above: LadderRow[]; below: LadderRow[] };

export type DashboardData = {
  duos: DashboardDuoCard[];
  activeDuoCount: number;
  maxActiveDuos: number;
  canFormMoreDuos: boolean;
};

/** Vorm van GET /api/duos/[id]/rating-history (nieuwste eerst). */
export type RatingHistoryRow = {
  id: string;
  ratingBefore: number;
  ratingAfter: number;
  isForfeit: boolean;
  createdAt: string;
  opponentName: string | null;
};

export type DuoCategory = "HEREN" | "DAMES" | "GEMENGD";

export const DUO_CATEGORY_LABELS: Record<DuoCategory, string> = {
  HEREN: "Heren",
  DAMES: "Dames",
  GEMENGD: "Gemengd",
};

export type Invitation = {
  id: string;
  duoName: string;
  regionId: string;
  region: { id: string; name: string; slug: string } | null;
  category: DuoCategory | null;
  /** Publieke weergavenaam (nooit e-mail). */
  proposedByName: string;
  invitedUserName: string;
  proposedByUserId: string;
  invitedUserId: string;
  status: string;
  createdAt: string;
};

export type InvitationsData = { received: Invitation[]; sent: Invitation[] };
