"use client";

import { CalendarPlus, Hourglass } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import SmoothDrawer from "@/components/kokonutui/smooth-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import {
  closedPostponements,
  dayOptions,
  formatDays,
  POSTPONEMENT_ACTION_TOASTS,
  POSTPONEMENT_REASON_MAX,
  POSTPONEMENT_STATUS_LABELS,
  postponementErrorMessage,
  type Postponement,
  type PostponementAction,
  type PostponementOverview,
} from "./postponement";
import { formatDateTime } from "./time";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Uitstel in onderling overleg voor een geaccepteerde, nog niet gespeelde
 * challenge (GET/POST /api/challenges/[id]/postponement). Wat de gebruiker
 * mag (aanvragen / accepteren-weigeren / intrekken) komt uit de overzicht-
 * flags van de server. `refreshKey` verandert als de challenge-lijst
 * herladen is (bijv. nieuwe deadline), zodat het overzicht meeverandert.
 */
export function PostponementPanel({
  challengeId,
  duoId,
  opponentName,
  refreshKey,
  onChanged,
}: {
  challengeId: string;
  /** Duo van waaruit de gebruiker kijkt (namens dit duo wordt uitstel gevraagd). */
  duoId: string;
  opponentName: string;
  refreshKey: string;
  onChanged: () => void;
}) {
  const [overview, setOverview] = useState<PostponementOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<PostponementAction | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(() => {
    const request = ++requestRef.current;
    apiFetch<PostponementOverview>(`/api/challenges/${challengeId}/postponement`)
      .then((data) => {
        if (request === requestRef.current) setOverview(data);
      })
      .catch(() => {
        // Uitstel is een extra; de rest van de kaart werkt zonder.
        if (request === requestRef.current) setOverview(null);
      });
  }, [challengeId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function answer(postponement: Postponement, action: PostponementAction) {
    setBusy(action);
    setError(null);
    try {
      await apiFetch(`/api/challenges/${challengeId}/postponement/${postponement.id}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      toast.success(POSTPONEMENT_ACTION_TOASTS[action]);
      load();
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? postponementErrorMessage(err.code, err.message) : "Er is iets misgegaan. Probeer het opnieuw.",
      );
      load();
    } finally {
      setBusy(null);
    }
  }

  if (!overview) return null;

  const pending = overview.pending;
  const closed = closedPostponements(overview);
  const ownRequest = pending?.requestedByDuoId === duoId;

  if (!pending && !overview.canRequest && closed.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" data-postponement>
      {pending ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-3 text-sm sm:px-4"
        >
          <div className="flex items-start gap-2.5">
            <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-semibold text-foreground">
                {ownRequest
                  ? `Jullie vroegen ${formatDays(pending.requestedDays)} uitstel`
                  : `${pending.requestedByDuoName} vraagt ${formatDays(pending.requestedDays)} uitstel`}
              </p>
              {pending.reason ? (
                <p className="break-words text-muted-foreground">&ldquo;{pending.reason}&rdquo;</p>
              ) : null}
              {pending.proposedMatchDeadline ? (
                <p className="text-muted-foreground">
                  Nieuwe speeldeadline bij akkoord:{" "}
                  <time dateTime={pending.proposedMatchDeadline} className="font-medium text-foreground">
                    {formatDateTime(pending.proposedMatchDeadline)}
                  </time>
                </p>
              ) : null}
              {ownRequest && !overview.canRespond ? (
                <p className="text-muted-foreground">Wacht op antwoord van {opponentName}.</p>
              ) : null}
            </div>
          </div>
          {overview.canRespond || overview.canCancel ? (
            <div className="flex flex-wrap gap-2">
              {overview.canRespond ? (
                <>
                  <Button type="button" size="sm" disabled={busy !== null} onClick={() => answer(pending, "accept")}>
                    Uitstel accepteren
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => answer(pending, "decline")}
                  >
                    Uitstel weigeren
                  </Button>
                </>
              ) : null}
              {overview.canCancel ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => answer(pending, "cancel")}
                >
                  Verzoek intrekken
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!pending && overview.canRequest ? (
        <RequestPostponement
          challengeId={challengeId}
          duoId={duoId}
          opponentName={opponentName}
          overview={overview}
          onRequested={() => {
            load();
            onChanged();
          }}
        />
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      {closed.length > 0 ? <PostponementHistory items={closed} /> : null}
    </div>
  );
}

function RequestPostponement({
  challengeId,
  duoId,
  opponentName,
  overview,
  onRequested,
}: {
  challengeId: string;
  duoId: string;
  opponentName: string;
  overview: PostponementOverview;
  onRequested: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(Math.min(3, overview.maxDays));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const options = dayOptions(overview.maxDays);
  const proposed = overview.matchDeadline ? new Date(new Date(overview.matchDeadline).getTime() + days * DAY_MS) : null;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/challenges/${challengeId}/postponement`, {
        method: "POST",
        body: JSON.stringify({ days, reason: reason.trim() || undefined, duoId }),
      });
      toast.success("Uitstel gevraagd");
      setOpen(false);
      setReason("");
      onRequested();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? postponementErrorMessage(err.code, err.message, overview.maxDays)
          : "Het verzoek kon niet worden verstuurd. Probeer het opnieuw.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
      <p className="text-muted-foreground">
        Lukt spelen niet vóór de deadline? Vraag {opponentName} om uitstel.
      </p>
      <SmoothDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        trigger={
          <Button type="button" size="sm" variant="soft">
            <CalendarPlus aria-hidden />
            Uitstel vragen
          </Button>
        }
        title={`Uitstel vragen aan ${opponentName}`}
        description={`${opponentName} moet akkoord geven; zonder akkoord blijft de huidige deadline staan. ${
          overview.remaining === 1
            ? "Dit kan nog één keer voor deze challenge."
            : `Dit kan nog ${overview.remaining} keer voor deze challenge.`
        }`}
        footer={
          <Button type="button" size="lg" disabled={submitting || options.length === 0} onClick={submit}>
            {submitting ? "Bezig met versturen…" : "Vraag uitstel aan"}
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Hoeveel dagen extra?</legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Aantal dagen uitstel">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={option === days}
                  aria-label={formatDays(option)}
                  onClick={() => setDays(option)}
                  className={cn(
                    "h-10 min-w-10 rounded-md border px-3 font-score text-lg tabular transition-colors",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    option === days
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card hover:bg-accent",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            {proposed ? (
              <p className="text-sm text-muted-foreground">
                Nieuwe speeldeadline bij akkoord:{" "}
                <span className="font-medium text-foreground">{formatDateTime(proposed)}</span>
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-2">
            <Label htmlFor={`${id}-reason`}>Reden (optioneel)</Label>
            <Textarea
              id={`${id}-reason`}
              rows={2}
              maxLength={POSTPONEMENT_REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Bijvoorbeeld: blessure, of geen baan vrij deze week."
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-3 py-2 text-sm text-loss">
              {error}
            </p>
          ) : null}
        </div>
      </SmoothDrawer>
    </div>
  );
}

const STATUS_BADGE: Record<Postponement["status"], "win" | "muted" | "warning"> = {
  pending: "warning",
  accepted: "win",
  declined: "muted",
  cancelled: "muted",
  expired: "muted",
};

function PostponementHistory({ items }: { items: Postponement[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-muted-foreground">Eerdere uitstelverzoeken</p>
      <ul className="flex flex-col divide-y rounded-lg border text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
            <span className="font-medium">
              {item.requestedByDuoName}: {formatDays(item.requestedDays)}
            </span>
            <Badge variant={STATUS_BADGE[item.status]}>{POSTPONEMENT_STATUS_LABELS[item.status]}</Badge>
            {item.status === "accepted" && item.newMatchDeadline ? (
              <span className="w-full text-xs text-muted-foreground">
                Speeldeadline verschoven naar {formatDateTime(item.newMatchDeadline)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
