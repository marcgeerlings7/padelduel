/**
 * Typen en pure indeling voor de challenges-weergave (geen React).
 * Vorm zoals GET /api/duos/[id]/challenges hem levert (listChallengesForDuo).
 */

export type ChallengeDuo = { id: string; name: string };
export type DisputeSummary = { id: string; status: string };

export type MatchStatus = "AWAITING_CONFIRMATION" | "COMPLETED" | "DISPUTED" | "VOIDED";
export type ChallengeStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "COMPLETED" | "UNPLAYED_TIMEOUT";

export type ChallengeMatch = {
  id: string;
  status: MatchStatus | string;
  scoreRaw: string;
  /** User-id van de indiener. */
  submittedBy: string;
  submittedAt: string;
  confirmedAt: string | null;
  autoConfirmDeadline: string;
  dispute: DisputeSummary | null;
};

export type Challenge = {
  id: string;
  status: ChallengeStatus | string;
  challengerDuoId: string;
  challengedDuoId: string;
  challengerDuo: ChallengeDuo;
  challengedDuo: ChallengeDuo;
  createdAt: string;
  respondedAt: string | null;
  responseDeadline: string;
  matchDeadline: string | null;
  /** Actieve (niet-voided) match; voided pogingen staan in voidedMatches. */
  match: ChallengeMatch | null;
  voidedMatches: ChallengeMatch[];
  dispute: DisputeSummary | null;
};

export type ChallengeGroup = "incoming" | "outgoing" | "toPlay" | "result" | "done";

export const GROUP_ORDER: readonly ChallengeGroup[] = ["incoming", "toPlay", "result", "outgoing", "done"];

export const GROUP_LABELS: Record<ChallengeGroup, string> = {
  incoming: "Inkomend",
  outgoing: "Uitgaand",
  toPlay: "Te spelen",
  result: "Uitslag",
  done: "Afgerond",
};

/**
 * Let op: de beschrijvingen bevatten bewust geen statuslabels
 * ("Wacht op bevestiging", "Betwist", …) — die zijn uniek per kaart.
 */
export const GROUP_DESCRIPTIONS: Record<ChallengeGroup, string> = {
  incoming: "Duo's die jullie uitdagen. Neem de uitdaging aan of wijs hem af.",
  outgoing: "Jullie uitdagingen die nog op antwoord wachten.",
  toPlay: "Aangenomen uitdagingen: speel de wedstrijd en vul de uitslag in.",
  result: "Ingevulde uitslagen die nog niet definitief zijn.",
  done: "Gespeeld, afgewezen of verlopen.",
};

export function roleOf(challenge: Challenge, duoId: string): "challenger" | "challenged" {
  return challenge.challengerDuoId === duoId ? "challenger" : "challenged";
}

export function opponentOf(challenge: Challenge, duoId: string): ChallengeDuo {
  return challenge.challengerDuoId === duoId ? challenge.challengedDuo : challenge.challengerDuo;
}

export function groupOf(challenge: Challenge, duoId: string): ChallengeGroup {
  switch (challenge.status) {
    case "PENDING":
      return challenge.challengedDuoId === duoId ? "incoming" : "outgoing";
    case "ACCEPTED":
      if (!challenge.match) return "toPlay";
      if (challenge.match.status === "AWAITING_CONFIRMATION" || challenge.match.status === "DISPUTED") {
        return "result";
      }
      return "done";
    default:
      return "done";
  }
}

/** Moment van de laatste gebeurtenis, voor de sortering van "Afgerond". */
export function lastActivity(challenge: Challenge): number {
  const candidates = [
    challenge.match?.confirmedAt,
    challenge.match?.submittedAt,
    challenge.respondedAt,
    challenge.createdAt,
  ];
  for (const value of candidates) {
    if (value) return new Date(value).getTime();
  }
  return 0;
}

function sortKey(challenge: Challenge, group: ChallengeGroup): number {
  switch (group) {
    case "incoming":
    case "outgoing":
      return new Date(challenge.responseDeadline).getTime();
    case "toPlay":
      return challenge.matchDeadline ? new Date(challenge.matchDeadline).getTime() : Number.MAX_SAFE_INTEGER;
    case "result":
      return challenge.match ? new Date(challenge.match.autoConfirmDeadline).getTime() : 0;
    case "done":
      return -lastActivity(challenge);
  }
}

/** Deelt challenges in per groep; binnen een groep de meest dringende eerst. */
export function groupChallenges(challenges: Challenge[], duoId: string): Record<ChallengeGroup, Challenge[]> {
  const groups: Record<ChallengeGroup, Challenge[]> = {
    incoming: [],
    outgoing: [],
    toPlay: [],
    result: [],
    done: [],
  };
  for (const challenge of challenges) {
    groups[groupOf(challenge, duoId)].push(challenge);
  }
  for (const group of GROUP_ORDER) {
    groups[group].sort((a, b) => sortKey(a, group) - sortKey(b, group));
  }
  return groups;
}

export type StatusTone = "soft" | "warning" | "win" | "muted" | "loss";

/**
 * Het ene statuslabel op een kaart. Bij een lopende match telt de
 * match-status, anders de challenge-status. Deze teksten zijn het e2e-contract
 * ("Geaccepteerd", "Wacht op bevestiging", "Betwist", "Voltooid").
 */
export function statusLabel(challenge: Challenge): { label: string; tone: StatusTone } {
  if (challenge.status === "ACCEPTED" && challenge.match) {
    if (challenge.match.status === "AWAITING_CONFIRMATION") return { label: "Wacht op bevestiging", tone: "warning" };
    if (challenge.match.status === "DISPUTED") return { label: "Betwist", tone: "warning" };
  }
  switch (challenge.status) {
    case "PENDING":
      return { label: "In afwachting", tone: "soft" };
    case "ACCEPTED":
      return { label: "Geaccepteerd", tone: "soft" };
    case "DECLINED":
      return { label: "Geweigerd", tone: "muted" };
    case "EXPIRED":
      return { label: "Verlopen", tone: "muted" };
    case "COMPLETED":
      return { label: "Voltooid", tone: "win" };
    case "UNPLAYED_TIMEOUT":
      return { label: "Niet gespeeld (forfeit)", tone: "loss" };
    default:
      return { label: challenge.status, tone: "muted" };
  }
}
