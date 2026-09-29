"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { DuoAvatar } from "@/components/app/DuoAvatar";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import {
  type DeciderMode,
  needsDecider,
  parseGames,
  previewScore,
  REGULAR_SET_PICKS,
  type Role,
  type SetDraft,
  setProblem,
  stepGames,
  toApiSets,
} from "./score-entry";

const EMPTY_SET: SetDraft = { own: "", opponent: "" };

/**
 * Score invoeren als scorebord (court-vlak): per set twee steppers (eigen duo
 * links, tegenstander rechts), snelkeuzes voor gangbare setstanden en — alleen
 * bij 1-1 in sets — een beslissende set of super-tiebreak. Validatie per set
 * met dezelfde regels als de server (src/lib/match/score.ts).
 *
 * e2e-contract: vier `input[type=number]` voor set 1 en 2 (eigen, tegenstander,
 * eigen, tegenstander) en de knop "Score indienen", zonder tussenstap.
 */
export function ScoreEntry({
  challengeId,
  role,
  ownName,
  opponentName,
  onSubmitted,
}: {
  challengeId: string;
  role: Role;
  ownName: string;
  opponentName: string;
  onSubmitted: () => void;
}) {
  const formId = useId();
  const [sets, setSets] = useState<SetDraft[]>([EMPTY_SET, EMPTY_SET, EMPTY_SET]);
  const [deciderMode, setDeciderMode] = useState<DeciderMode>("set");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showDecider = needsDecider(sets[0], sets[1]);
  const visibleCount = showDecider ? 3 : 2;
  const preview = previewScore(sets, deciderMode);

  function update(index: number, patch: Partial<SetDraft>) {
    setError(null);
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const apiSets = toApiSets(sets, role);
    if (!apiSets) {
      setError("Vul van elke set de games van beide duo's in.");
      return;
    }
    for (let i = 0; i < visibleCount; i++) {
      const problem = setProblem(sets[i], i === 2 ? deciderMode : "set");
      if (problem) {
        setError(`Set ${i + 1}: ${problem}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/challenges/${challengeId}/score`, {
        method: "POST",
        body: JSON.stringify({ sets: apiSets, idempotencyKey: crypto.randomUUID() }),
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "De score kon niet worden verstuurd. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${formId}-title`}
      className="court-lines relative flex flex-col gap-4 overflow-hidden rounded-xl bg-court p-4 text-court-foreground shadow-raised sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`${formId}-title`} className="font-display text-xl leading-tight font-bold">
          Uitslag invullen
        </h3>
        <p className="text-xs text-court-muted">Games per set</p>
      </div>

      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-2 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-4">
        <span aria-hidden />
        <TeamHead name={ownName} own />
        <TeamHead name={opponentName} />

        {sets.slice(0, visibleCount).map((set, index) => {
          const isDecider = index === 2;
          const mode: DeciderMode = isDecider ? deciderMode : "set";
          const problem = setProblem(set, mode);
          const problemId = `${formId}-set${index}-problem`;
          const label = isDecider && deciderMode === "tiebreak" ? "Super-tiebreak" : `Set ${index + 1}`;
          return (
            <SetRow
              key={index}
              index={index}
              label={label}
              shortLabel={isDecider && deciderMode === "tiebreak" ? "Tb" : `Set ${index + 1}`}
              set={set}
              mode={mode}
              problem={problem}
              problemId={problemId}
              ownName={ownName}
              opponentName={opponentName}
              onChange={(patch) => update(index, patch)}
              deciderControl={
                isDecider ? (
                  <DeciderToggle
                    value={deciderMode}
                    onChange={(value) => {
                      setDeciderMode(value);
                      update(2, { own: "", opponent: "" });
                    }}
                  />
                ) : null
              }
            />
          );
        })}
      </div>

      <div aria-live="polite" className="min-h-5 text-sm">
        {preview ? (
          <p className="font-medium">
            {preview.winner === "own" ? ownName : opponentName} wint met{" "}
            <span className="font-score text-lg">
              {Math.max(preview.ownSets, preview.opponentSets)}-{Math.min(preview.ownSets, preview.opponentSets)}
            </span>{" "}
            in sets
          </p>
        ) : (
          <p className="text-court-muted">
            {showDecider ? "1-1 in sets: vul de beslissende set in." : "Vul beide sets in."}
          </p>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[#ffc2c6]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="submit"
          variant="ball"
          size="lg"
          disabled={submitting}
          className="w-full focus-visible:ring-ball/60 sm:w-auto"
        >
          {submitting ? "Bezig met indienen…" : "Score indienen"}
        </Button>
        <p className="text-xs text-court-muted">{opponentName} controleert daarna de uitslag.</p>
      </div>
    </form>
  );
}

function TeamHead({ name, own = false }: { name: string; own?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <DuoAvatar name={name} size="sm" own={own} className={own ? "ring-offset-court" : undefined} />
      <span className="w-full truncate text-xs font-semibold" title={name}>
        {name}
      </span>
    </div>
  );
}

function SetRow({
  index,
  label,
  shortLabel,
  set,
  mode,
  problem,
  problemId,
  ownName,
  opponentName,
  onChange,
  deciderControl,
}: {
  index: number;
  label: string;
  shortLabel: string;
  set: SetDraft;
  mode: DeciderMode;
  problem: string | null;
  problemId: string;
  ownName: string;
  opponentName: string;
  onChange: (patch: Partial<SetDraft>) => void;
  deciderControl: React.ReactNode;
}) {
  const own = parseGames(set.own);
  const opponent = parseGames(set.opponent);
  const stripRef = useRef<HTMLDivElement>(null);

  // Houd de gekozen snelkeuze in beeld (verloren sets staan rechts in de strook).
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !chip) return;
    const left = chip.offsetLeft; // strip is positioned → offsetParent
    const right = left + chip.offsetWidth;
    if (left >= strip.scrollLeft && right <= strip.scrollLeft + strip.clientWidth) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({ left: Math.max(0, left - strip.clientWidth / 2 + chip.offsetWidth / 2), behavior: reduce ? "auto" : "smooth" });
  }, [own, opponent]);

  return (
    <>
      {deciderControl ? <div className="col-span-3 mt-1">{deciderControl}</div> : null}
      <span className="font-display text-sm leading-tight font-semibold text-court-muted" aria-hidden>
        {shortLabel}
      </span>
      <Stepper
        value={set.own}
        label={`${label}: games ${ownName}`}
        invalid={Boolean(problem)}
        describedBy={problem ? problemId : undefined}
        onChange={(value) => onChange({ own: value })}
      />
      <Stepper
        value={set.opponent}
        label={`${label}: games ${opponentName}`}
        invalid={Boolean(problem)}
        describedBy={problem ? problemId : undefined}
        onChange={(value) => onChange({ opponent: value })}
      />
      {mode === "set" ? (
        <div ref={stripRef} className="relative col-span-3 -mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:col-span-2 sm:col-start-2">
          <div role="group" aria-label={`${label}: snelkeuze setstand`} className="flex w-max gap-1.5">
            {REGULAR_SET_PICKS.map(([win, lose]) => (
              <QuickPick
                key={`w${win}${lose}`}
                own={win}
                opponent={lose}
                selected={own === win && opponent === lose}
                label={label}
                onPick={() => onChange({ own: String(win), opponent: String(lose) })}
              />
            ))}
            <span aria-hidden className="mx-0.5 w-px self-stretch bg-white/20" />
            {REGULAR_SET_PICKS.map(([win, lose]) => (
              <QuickPick
                key={`l${win}${lose}`}
                own={lose}
                opponent={win}
                selected={own === lose && opponent === win}
                label={label}
                onPick={() => onChange({ own: String(lose), opponent: String(win) })}
              />
            ))}
          </div>
        </div>
      ) : null}
      {problem ? (
        <p id={problemId} className="col-span-3 -mt-1 text-xs font-medium text-[#ffc2c6] sm:col-span-2 sm:col-start-2">
          {problem}
        </p>
      ) : null}
      {index < 2 ? <span aria-hidden className="col-span-3 h-px bg-white/10" /> : null}
    </>
  );
}

function Stepper({
  value,
  label,
  invalid,
  describedBy,
  onChange,
}: {
  value: string;
  label: string;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}) {
  const numeric = parseGames(value);
  const buttonClass =
    "flex size-9 shrink-0 items-center justify-center rounded-md bg-white/10 text-court-foreground transition-colors hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ball/70 disabled:opacity-40 motion-reduce:active:scale-100";
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        className={buttonClass}
        aria-label={`${label} verlagen`}
        disabled={numeric === null || numeric === 0}
        onClick={() => onChange(stepGames(value, -1))}
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        step={1}
        required
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        placeholder="–"
        onChange={(e) => onChange(e.target.value.slice(0, 2))}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          "h-11 w-12 min-w-0 rounded-md border border-white/20 bg-white/10 text-center font-score text-[1.75rem] text-court-foreground tabular outline-none placeholder:text-court-muted/60",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          "focus-visible:border-ball focus-visible:ring-[3px] focus-visible:ring-ball/50",
          invalid && "border-[#ffc2c6]",
        )}
      />
      <button type="button" className={buttonClass} aria-label={`${label} verhogen`} onClick={() => onChange(stepGames(value, 1))}>
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}

function QuickPick({
  own,
  opponent,
  selected,
  label,
  onPick,
}: {
  own: number;
  opponent: number;
  selected: boolean;
  label: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${label}: ${own}-${opponent}`}
      onClick={onPick}
      className={cn(
        "h-8 min-w-11 rounded-full px-2.5 font-score text-base tabular transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ball/70",
        selected ? "bg-court-foreground text-court" : "bg-white/10 text-court-foreground hover:bg-white/20",
        own < opponent && !selected && "text-court-muted",
      )}
    >
      {own}-{opponent}
    </button>
  );
}

function DeciderToggle({ value, onChange }: { value: DeciderMode; onChange: (value: DeciderMode) => void }) {
  const options: { value: DeciderMode; label: string }[] = [
    { value: "set", label: "Derde set" },
    { value: "tiebreak", label: "Super-tiebreak" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-court-muted">Beslissende set</p>
      <div role="radiogroup" aria-label="Beslissende set" className="grid grid-cols-2 gap-1 rounded-lg bg-white/10 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ball/70",
              value === option.value ? "bg-court-foreground text-court" : "text-court-foreground hover:bg-white/10",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
