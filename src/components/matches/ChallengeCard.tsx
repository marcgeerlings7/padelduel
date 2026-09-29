"use client";

import { CircleAlert, Scale, ShieldCheck, Swords } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DuoAvatar } from "@/components/app/DuoAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Challenge, type ChallengeGroup, opponentOf, roleOf, statusLabel } from "./challenges";
import { DeadlineChip } from "./DeadlineChip";
import { DisputeForm } from "./DisputeForm";
import { ScoreEntry } from "./ScoreEntry";
import { formatSets, perspectiveSets } from "./score-entry";
import { SetScoreline } from "./SetScoreline";
import { deadlineUrgency, formatShortDate } from "./time";

export type ChallengeActions = {
  respond: (challengeId: string, decision: "accept" | "decline") => void;
  respondToMatch: (matchId: string, decision: "confirm" | "dispute") => void;
  reload: () => void;
};

/**
 * Eén challenge als kaart (`<li>`), vanuit het perspectief van `duoId`.
 * e2e-contract: de kaart is een `li` met de tekst "vs. <tegenstander>",
 * precies één statuslabel, en de knoppen Accepteren / Weigeren /
 * Bevestigen / Betwisten / Score indienen / Dispute openen.
 */
export function ChallengeCard({
  challenge: c,
  group,
  duoId,
  ownName,
  myUserId,
  busyId,
  actions,
}: {
  challenge: Challenge;
  group: ChallengeGroup;
  duoId: string;
  ownName: string;
  myUserId: string | null;
  busyId: string | null;
  actions: ChallengeActions;
}) {
  const role = roleOf(c, duoId);
  const opponent = opponentOf(c, duoId);
  const status = statusLabel(c);
  const matchSets = c.match ? perspectiveSets(c.match.scoreRaw, role) : [];
  const ownSetsWon = matchSets.filter((s) => s.own > s.opponent).length;
  const wonMatch = matchSets.length > 0 && ownSetsWon * 2 > matchSets.length;
  const submittedByMe = Boolean(c.match && myUserId && c.match.submittedBy === myUserId);
  const needsAction =
    group === "incoming" ||
    group === "toPlay" ||
    (c.match?.status === "AWAITING_CONFIRMATION" && !submittedByMe) ||
    (c.match?.status === "DISPUTED" && !c.match.dispute);

  const roleLine =
    role === "challenger"
      ? `Jullie daagden uit op ${formatShortDate(c.createdAt)}`
      : `Daagde jullie uit op ${formatShortDate(c.createdAt)}`;

  return (
    <li
      data-group={group}
      data-action={needsAction || undefined}
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 text-card-foreground shadow-card sm:p-5",
        needsAction && "border-primary/35",
      )}
    >
      {needsAction ? <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" /> : null}

      <div className="flex items-start gap-3">
        <DuoAvatar name={opponent.name} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate font-display text-xl leading-tight font-bold">vs. {opponent.name}</p>
          <p className="text-xs text-muted-foreground">{roleLine}</p>
        </div>
        <Badge variant={status.tone} className="mt-0.5">
          {status.label}
        </Badge>
      </div>

      <CardBody challenge={c} group={group} role={role} ownName={ownName} opponentName={opponent.name}
        matchSets={matchSets} wonMatch={wonMatch} submittedByMe={submittedByMe} busyId={busyId} actions={actions} />

      <div className="-mx-4 -mb-4 flex items-center justify-between gap-2 border-t px-4 py-2 sm:-mx-5 sm:-mb-5 sm:px-5">
        <Link
          href={`/duos/${duoId}/head-to-head/${opponent.id}`}
          className="-ml-1 inline-flex min-h-9 items-center gap-1.5 rounded-sm px-1 text-sm font-medium text-primary no-underline hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Swords aria-hidden className="size-4" />
          Onderling resultaat
        </Link>
        {c.match && matchSets.length > 0 && group === "done" ? (
          <span className={cn("text-xs font-semibold", wonMatch ? "text-win" : "text-loss")}>
            {wonMatch ? "Gewonnen" : "Verloren"}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function Note({ icon: Icon, children, tone = "muted" }: { icon: typeof Scale; children: ReactNode; tone?: "muted" | "warning" }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "warning" && "bg-warning-soft text-warning",
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function CardBody({
  challenge: c,
  group,
  role,
  ownName,
  opponentName,
  matchSets,
  wonMatch,
  submittedByMe,
  busyId,
  actions,
}: {
  challenge: Challenge;
  group: ChallengeGroup;
  role: "challenger" | "challenged";
  ownName: string;
  opponentName: string;
  matchSets: ReturnType<typeof perspectiveSets>;
  wonMatch: boolean;
  submittedByMe: boolean;
  busyId: string | null;
  actions: ChallengeActions;
}) {
  const pendingOverdue = deadlineUrgency(c.responseDeadline) === "overdue";

  if (group === "incoming") {
    return (
      <>
        <DeadlineChip deadline={c.responseDeadline} prefix={pendingOverdue ? "Verlopen" : "Verloopt"} />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" disabled={busyId === c.id} onClick={() => actions.respond(c.id, "accept")}>
            Accepteren
          </Button>
          <Button type="button" variant="outline" disabled={busyId === c.id} onClick={() => actions.respond(c.id, "decline")}>
            Weigeren
          </Button>
        </div>
      </>
    );
  }

  if (group === "outgoing") {
    return (
      <>
        <DeadlineChip deadline={c.responseDeadline} prefix={pendingOverdue ? "Verlopen" : "Verloopt"} />
        <p className="text-sm text-muted-foreground">{opponentName} moet de uitdaging nog aannemen of afwijzen.</p>
      </>
    );
  }

  if (group === "toPlay") {
    const lastVoided = c.voidedMatches[0];
    return (
      <>
        {c.matchDeadline ? <DeadlineChip deadline={c.matchDeadline} prefix="Speeldeadline" /> : null}
        {lastVoided ? (
          <Note icon={CircleAlert} tone="warning">
            Eerdere score ({formatSets(perspectiveSets(lastVoided.scoreRaw, role))}) is ongeldig verklaard door een admin —
            speel opnieuw en dien een nieuwe score in.
          </Note>
        ) : null}
        <ScoreEntry
          challengeId={c.id}
          role={role}
          ownName={ownName}
          opponentName={opponentName}
          onSubmitted={actions.reload}
        />
      </>
    );
  }

  const match = c.match;

  if (group === "result" && match) {
    return (
      <>
        <MatchScore sets={matchSets} ownName={ownName} opponentName={opponentName} />
        {match.status === "AWAITING_CONFIRMATION" ? (
          <>
            <DeadlineChip deadline={match.autoConfirmDeadline} prefix="Automatisch definitief" />
            {submittedByMe ? (
              <p className="text-sm text-muted-foreground">
                Jij hebt deze uitslag ingevuld. {opponentName} kan hem goedkeuren of er een dispute over openen.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  De uitslag is ingevuld. Klopt hij? Zonder reactie wordt hij vanzelf definitief.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    type="button"
                    disabled={busyId === match.id}
                    onClick={() => actions.respondToMatch(match.id, "confirm")}
                  >
                    Bevestigen
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId === match.id}
                    onClick={() => actions.respondToMatch(match.id, "dispute")}
                  >
                    Betwisten
                  </Button>
                </div>
              </>
            )}
          </>
        ) : null}
        {match.status === "DISPUTED" && !match.dispute ? (
          <DisputeForm
            submitPath={`/api/matches/${match.id}/disputes`}
            label="Wat klopt er niet aan deze uitslag?"
            hint="Een admin beoordeelt de dispute en handhaaft de score of verklaart de match ongeldig."
            onSubmitted={actions.reload}
          />
        ) : null}
        {match.dispute ? <Note icon={Scale}>Dispute geopend — wordt beoordeeld door een admin.</Note> : null}
      </>
    );
  }

  // Afgerond
  return (
    <>
      {match && matchSets.length > 0 ? (
        <MatchScore sets={matchSets} ownName={ownName} opponentName={opponentName} won={wonMatch} />
      ) : null}
      {match?.dispute && match.dispute.status !== "OPEN" ? (
        <Note icon={ShieldCheck}>Na een dispute heeft een admin deze uitslag gehandhaafd.</Note>
      ) : null}
      {c.status === "DECLINED" ? (
        <p className="text-sm text-muted-foreground">
          {role === "challenger" ? `${opponentName} heeft de uitdaging afgewezen.` : "Jullie hebben de uitdaging afgewezen."}
        </p>
      ) : null}
      {c.status === "EXPIRED" ? (
        <p className="text-sm text-muted-foreground">
          {role === "challenger"
            ? `${opponentName} reageerde niet op tijd en kreeg een forfeit-penalty.`
            : "Jullie reageerden niet op tijd; dat leverde een forfeit-penalty op."}
        </p>
      ) : null}
      {c.status === "UNPLAYED_TIMEOUT" ? (
        <>
          <p className="text-sm text-muted-foreground">
            Niet gespeeld vóór de speeldeadline. Dat levert een vaste forfeit-penalty op, geen ELO-berekening.
          </p>
          {!c.dispute ? (
            <DisputeForm
              submitPath={`/api/challenges/${c.id}/disputes`}
              label="Lag het niet aan jullie? Leg uit waarom."
              hint="Een admin kan de forfeit-penalty terugdraaien voor het duo dat geen schuld had."
              onSubmitted={actions.reload}
            />
          ) : null}
        </>
      ) : null}
      {c.dispute ? <ForfeitDisputeNote status={c.dispute.status} /> : null}
    </>
  );
}

function ForfeitDisputeNote({ status }: { status: string }) {
  if (status === "RESOLVED_UPHELD") {
    return <Note icon={Scale}>Forfeit-dispute afgehandeld: de penalty blijft staan.</Note>;
  }
  if (status === "RESOLVED_OVERTURNED") {
    return <Note icon={ShieldCheck}>Forfeit-dispute toegekend: de penalty is gecorrigeerd.</Note>;
  }
  return <Note icon={Scale}>Forfeit-dispute geopend — wordt beoordeeld door een admin.</Note>;
}

function MatchScore({
  sets,
  ownName,
  opponentName,
  won,
}: {
  sets: ReturnType<typeof perspectiveSets>;
  ownName: string;
  opponentName: string;
  won?: boolean;
}) {
  if (sets.length === 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-2 pr-3">
      <div aria-hidden className="flex min-w-0 flex-1 flex-col gap-1 pl-1 text-sm leading-[1.35rem]">
        <span className={cn("truncate", won === true ? "font-semibold" : "text-muted-foreground")}>{ownName}</span>
        <span className={cn("truncate", won === false ? "font-semibold" : "text-muted-foreground")}>{opponentName}</span>
      </div>
      <SetScoreline sets={sets} />
    </div>
  );
}
