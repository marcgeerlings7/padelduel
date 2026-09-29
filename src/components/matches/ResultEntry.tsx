"use client";

import { Flag, Minus, Plus, UserX } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/app/SegmentedControl";
import SmoothDrawer from "@/components/kokonutui/smooth-drawer";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/client/api";
import {
  MAX_RETIRED_SETS,
  previewRetirement,
  RESULT_CHOICES,
  type ResultChoice,
  type RetiredBy,
  scoreErrorMessage,
} from "./result-type";
import { ScoreEntry, Stepper, TeamHead } from "./ScoreEntry";
import type { Role, SetDraft } from "./score-entry";
import { SetScoreline } from "./SetScoreline";

type EntryProps = {
  challengeId: string;
  role: Role;
  ownName: string;
  opponentName: string;
  onSubmitted: () => void;
};

/**
 * Uitslag invullen met keuze van de uitslagsoort (KNLTB): "Gespeeld"
 * (standaard, het bestaande scorebord), "Walkover" (de tegenstander kwam
 * niet; alleen te melden door het duo dat er wél was, met bevestigingsstap)
 * of "Opgave" (gespeelde stand + wie opgaf). Validatie gelijk aan de server
 * (src/lib/match/resultType.ts).
 *
 * e2e-contract: standaard staat "Gespeeld" aan, dus de vier
 * `input[type=number]` en "Score indienen" van ScoreEntry blijven direct
 * bruikbaar.
 */
export function ResultEntry(props: EntryProps) {
  const [choice, setChoice] = useState<ResultChoice>("played");

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl label="Soort uitslag" options={RESULT_CHOICES} value={choice} onChange={setChoice} />
      {choice === "played" ? <ScoreEntry {...props} /> : null}
      {choice === "walkover" ? <WalkoverEntry {...props} /> : null}
      {choice === "retired" ? <RetirementEntry {...props} /> : null}
    </div>
  );
}

async function submitResult(challengeId: string, body: Record<string, unknown>) {
  await apiFetch(`/api/challenges/${challengeId}/score`, {
    method: "POST",
    body: JSON.stringify({ ...body, idempotencyKey: crypto.randomUUID() }),
  });
}

function errorText(err: unknown): string {
  return err instanceof ApiError
    ? scoreErrorMessage(err.code, err.message)
    : "De uitslag kon niet worden verstuurd. Probeer het opnieuw.";
}

function CourtPanel({
  titleId,
  title,
  aside,
  children,
}: {
  titleId: string;
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className="court-lines relative flex flex-col gap-4 overflow-hidden rounded-xl bg-court p-4 text-court-foreground shadow-raised sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={titleId} className="font-display text-xl leading-tight font-bold">
          {title}
        </h3>
        {aside ? <p className="text-xs text-court-muted">{aside}</p> : null}
      </div>
      {children}
    </section>
  );
}

function CourtError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[#ffc2c6]">
      {children}
    </p>
  );
}

/** Walkover: alleen voor het duo dat er wél was; eerst bevestigen in een bottom sheet. */
function WalkoverEntry({ challengeId, ownName, opponentName, onSubmitted }: EntryProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      await submitResult(challengeId, { resultType: "walkover" });
      setOpen(false);
      toast.success("Walkover gemeld");
      onSubmitted();
    } catch (err) {
      setOpen(false);
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CourtPanel titleId={titleId} title="Walkover melden">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10">
          <UserX aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5 text-sm">
          <p className="font-medium">
            Alleen voor als jullie er wél waren en {opponentName} niet kwam opdagen (of vóór de start afzegde).
          </p>
          <p className="text-court-muted">
            Een walkover telt als 6-0 6-0 voor {ownName} en gaat via de gewone ratingberekening. {opponentName} kan de
            melding daarna bevestigen of betwisten.
          </p>
        </div>
      </div>

      {error ? <CourtError>{error}</CourtError> : null}

      <SmoothDrawer
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button type="button" variant="ball" size="lg" className="w-full focus-visible:ring-ball/60 sm:w-auto">
            Walkover melden
          </Button>
        }
        title={`Walkover tegen ${opponentName}?`}
        description={`Je meldt dat ${opponentName} niet is komen opdagen. De uitslag wordt 6-0 6-0 voor ${ownName}; ${opponentName} krijgt een verzoek om dit te bevestigen.`}
        footer={
          <Button type="button" size="lg" disabled={submitting} onClick={confirm}>
            {submitting ? "Bezig met melden…" : "Bevestig walkover"}
          </Button>
        }
      />
    </CourtPanel>
  );
}

const EMPTY_SET: SetDraft = { own: "", opponent: "" };

/** Opgave: gespeelde stand (laatste set mag onafgemaakt) + welk duo opgaf. */
function RetirementEntry({ challengeId, role, ownName, opponentName, onSubmitted }: EntryProps) {
  const titleId = useId();
  const [sets, setSets] = useState<SetDraft[]>([EMPTY_SET]);
  const [retiredBy, setRetiredBy] = useState<RetiredBy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const preview = previewRetirement(sets, retiredBy, role);
  const problem = !preview.ok ? preview.error : null;

  function update(index: number, patch: Partial<SetDraft>) {
    setError(null);
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!preview.ok) {
      setShowProblems(true);
      setError(
        preview.error ??
          (retiredBy ? "Vul van elke set de games van beide duo's in." : "Kies welk duo heeft opgegeven."),
      );
      return;
    }
    setSubmitting(true);
    try {
      await submitResult(challengeId, {
        resultType: "retired",
        sets: preview.apiSets,
        retiredSide: preview.retiredSide,
      });
      toast.success("Opgave ingediend");
      onSubmitted();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  }

  const won = preview.ok ? preview.completed.filter((s) => s.own > s.opponent).length >= 2 : null;

  return (
    <form onSubmit={handleSubmit} noValidate aria-labelledby={titleId}>
      <CourtPanel titleId={titleId} title="Opgave invullen" aside="Stand bij opgave">
        <div className="flex flex-col gap-2">
          <p aria-hidden className="text-xs text-court-muted">
            Welk duo gaf op?
          </p>
          <SegmentedControl
            label="Welk duo gaf op?"
            tone="court"
            options={[
              { value: "own" as const, label: ownName },
              { value: "opponent" as const, label: opponentName },
            ]}
            value={retiredBy}
            onChange={(value) => {
              setError(null);
              setRetiredBy(value);
            }}
          />
        </div>

        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-4">
          <span aria-hidden />
          <TeamHead name={ownName} own />
          <TeamHead name={opponentName} />
          {sets.map((set, index) => {
            const label = `Opgave set ${index + 1}`;
            return (
              <div key={index} className="contents">
                <span className="font-display text-sm leading-tight font-semibold text-court-muted" aria-hidden>
                  Set {index + 1}
                </span>
                <Stepper
                  value={set.own}
                  label={`${label}: games ${ownName}`}
                  invalid={showProblems && Boolean(problem)}
                  onChange={(value) => update(index, { own: value })}
                />
                <Stepper
                  value={set.opponent}
                  label={`${label}: games ${opponentName}`}
                  invalid={showProblems && Boolean(problem)}
                  onChange={(value) => update(index, { opponent: value })}
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {sets.length < MAX_RETIRED_SETS ? (
            <button
              type="button"
              onClick={() => setSets((prev) => [...prev, EMPTY_SET])}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-white/10 px-3 text-sm font-semibold transition-colors hover:bg-white/20 focus-visible:ring-[3px] focus-visible:ring-ball/70 focus-visible:outline-none"
            >
              <Plus aria-hidden className="size-4" />
              Set toevoegen
            </button>
          ) : null}
          {sets.length > 1 ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSets((prev) => prev.slice(0, -1));
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-court-muted transition-colors hover:bg-white/10 hover:text-court-foreground focus-visible:ring-[3px] focus-visible:ring-ball/70 focus-visible:outline-none"
            >
              <Minus aria-hidden className="size-4" />
              Laatste set weg
            </button>
          ) : null}
        </div>

        <div aria-live="polite" className="min-h-5 text-sm">
          {preview.ok ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-medium">
                Telt als {won ? "winst" : "verlies"} voor {ownName}:
              </span>
              <SetScoreline sets={preview.completed} tone="court" size="sm" />
            </div>
          ) : problem ? (
            <p className="text-[#ffc2c6]">{problem}</p>
          ) : (
            <p className="text-court-muted">
              Vul de stand in op het moment van opgave; de laatste set mag onafgemaakt zijn (bijv. 3-2).
            </p>
          )}
        </div>

        {error && error !== problem ? <CourtError>{error}</CourtError> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="submit"
            variant="ball"
            size="lg"
            disabled={submitting}
            className="w-full focus-visible:ring-ball/60 sm:w-auto"
          >
            <Flag aria-hidden />
            {submitting ? "Bezig met indienen…" : "Opgave indienen"}
          </Button>
          <p className="text-xs text-court-muted">{opponentName} controleert daarna de uitslag.</p>
        </div>
      </CourtPanel>
    </form>
  );
}
