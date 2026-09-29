/**
 * Types en pure helpers voor uitstel in onderling overleg (geen React).
 * Vorm zoals GET /api/challenges/[id]/postponement hem levert
 * (postponementService.getPostponementOverview).
 */

export type PostponementStatusName = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export type Postponement = {
  id: string;
  challengeId: string;
  requestedByDuoId: string;
  requestedByDuoName: string;
  requestedDays: number;
  reason: string | null;
  status: PostponementStatusName;
  proposedMatchDeadline: string | null;
  previousMatchDeadline: string | null;
  newMatchDeadline: string | null;
  createdAt: string;
  respondedAt: string | null;
};

export type PostponementOverview = {
  challengeId: string;
  challengeStatus: string;
  matchDeadline: string | null;
  maxDays: number;
  maxPerChallenge: number;
  acceptedCount: number;
  remaining: number;
  canRequest: boolean;
  canRespond: boolean;
  canCancel: boolean;
  pending: Postponement | null;
  history: Postponement[];
};

export type PostponementAction = "accept" | "decline" | "cancel";

export const POSTPONEMENT_STATUS_LABELS: Record<PostponementStatusName, string> = {
  pending: "Wacht op antwoord",
  accepted: "Geaccepteerd",
  declined: "Geweigerd",
  cancelled: "Ingetrokken",
  expired: "Verlopen",
};

export const POSTPONEMENT_ACTION_TOASTS: Record<PostponementAction, string> = {
  accept: "Uitstel geaccepteerd",
  decline: "Uitstel geweigerd",
  cancel: "Uitstelverzoek ingetrokken",
};

/** "1 dag" / "3 dagen". */
export function formatDays(days: number): string {
  return `${days} ${days === 1 ? "dag" : "dagen"}`;
}

/** Keuzes voor het aantal dagen: 1 t/m maxDays (maxDays uit platform_config). */
export function dayOptions(maxDays: number): number[] {
  const max = Math.max(0, Math.floor(maxDays));
  return Array.from({ length: max }, (_, i) => i + 1);
}

/** Afgeronde verzoeken (alles behalve het openstaande), nieuwste eerst. */
export function closedPostponements(overview: PostponementOverview): Postponement[] {
  return overview.history.filter((p) => p.status !== "pending");
}

export const POSTPONEMENT_REASON_MAX = 500;

/**
 * Nederlandse melding per foutcode van de uitstel-endpoints; onbekende codes
 * vallen terug op de (al Nederlandse) servermelding.
 */
export function postponementErrorMessage(code: string | undefined, fallback: string, maxDays?: number): string {
  switch (code) {
    case "invalid_days":
      return maxDays ? `Kies 1 tot en met ${formatDays(maxDays)} uitstel.` : fallback;
    case "invalid_input":
      return "Controleer het aantal dagen en de reden (maximaal 500 tekens).";
    case "challenge_not_accepted":
      return "Uitstel kan alleen voor een geaccepteerde challenge die nog gespeeld moet worden.";
    case "match_deadline_passed":
      return "De speeltermijn is al verstreken; uitstel is niet meer mogelijk.";
    case "score_already_submitted":
      return "Er is al een uitslag ingevuld, dus uitstel is niet meer nodig.";
    case "postponement_already_pending":
      return "Er staat al een uitstelverzoek open. Wacht op het antwoord of trek het in.";
    case "postponement_limit_reached":
      return "Voor deze challenge is het maximale aantal keer uitstel al gebruikt.";
    case "postponement_not_pending":
      return "Dit verzoek staat niet meer open. Ververs de pagina voor de actuele stand.";
    case "postponement_not_found":
      return "Dit uitstelverzoek bestaat niet (meer). Ververs de pagina.";
    case "cannot_answer_own_request":
      return "Je kunt niet op je eigen uitstelverzoek reageren; je tegenstander moet antwoorden.";
    case "not_authorized":
      return "Alleen het andere duo kan dit verzoek accepteren of weigeren; alleen de aanvragers kunnen het intrekken.";
    case "not_a_member":
      return "Je bent geen lid van een van beide duo's.";
    case "ambiguous_duo":
      return "Je zit in beide duo's; vraag uitstel aan vanaf de challenges-pagina van het juiste duo.";
    default:
      return fallback;
  }
}
