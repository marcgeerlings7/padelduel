"use client";

import { useId, useState } from "react";
import { m } from "motion/react";
import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { formatRating, formatSignedDelta } from "@/components/app/format";
import { transition } from "@/components/app/motion";
import { cn } from "@/lib/utils";
import {
  DEMO_MATCHUPS,
  DEMO_SCORELINES,
  computeDemoOutcome,
  formatDecimal,
  formatPercent,
} from "./landing-data";

/**
 * Rekenvoorbeeld: kies een uitslag en een krachtsverhouding en zie wat de
 * echte ratingberekening (applyMatchResult, standaardinstellingen) oplevert.
 */
export function EloDemo() {
  const [scorelineId, setScorelineId] = useState(DEMO_SCORELINES[1].id);
  const [matchupId, setMatchupId] = useState(DEMO_MATCHUPS[0].id);
  const scoreline = DEMO_SCORELINES.find((x) => x.id === scorelineId) ?? DEMO_SCORELINES[0];
  const matchup = DEMO_MATCHUPS.find((x) => x.id === matchupId) ?? DEMO_MATCHUPS[0];
  const outcome = computeDemoOutcome(matchup, scoreline);

  return (
    <div className="grid gap-5 rounded-2xl border bg-card p-4 shadow-card sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8">
      <div className="flex flex-col gap-5">
        <Segmented
          legend="Uitslag"
          name="demo-uitslag"
          value={scorelineId}
          onChange={setScorelineId}
          options={DEMO_SCORELINES.map((x) => ({ value: x.id, label: x.label }))}
          score
        />
        <Segmented
          legend="Krachtsverhouding"
          name="demo-verhouding"
          value={matchupId}
          onChange={setMatchupId}
          options={DEMO_MATCHUPS.map((x) => ({ value: x.id, label: x.label }))}
        />
        <p className="text-sm text-muted-foreground">
          Twee gevestigde duo&apos;s (K = {outcome.baseK}), gerekend met de standaardinstellingen van de ladder.
        </p>
      </div>

      <div className="flex flex-col gap-4" aria-live="polite">
        <div className="grid grid-cols-2 gap-3">
          <ResultTile
            label="Winnaar"
            rating={matchup.winnerRating}
            delta={outcome.winnerDelta}
            tone="win"
          />
          <ResultTile
            label="Verliezer"
            rating={matchup.loserRating}
            delta={outcome.loserDelta}
            tone="loss"
          />
        </div>

        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border text-center">
          <Fact term="Verwachte winkans" value={formatPercent(outcome.winnerExpected)} />
          <Fact term="Games (KNLTB)" value={`${outcome.winnerGames}-${outcome.loserGames}`} />
          <Fact term="Gamesaldo-factor" value={`× ${formatDecimal(outcome.marginMultiplier)}`} />
        </dl>
        <MarginBar multiplier={outcome.marginMultiplier} />
      </div>
    </div>
  );
}

function ResultTile({
  label,
  rating,
  delta,
  tone,
}: {
  label: string;
  rating: number;
  delta: number;
  tone: "win" | "loss";
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl p-3 sm:p-4", tone === "win" ? "bg-win-soft" : "bg-loss-soft")}>
      <span className="text-xs font-semibold text-muted-foreground">
        {label}, rating <span className="tabular">{formatRating(rating)}</span>
      </span>
      <span className={cn("font-score text-5xl sm:text-6xl", tone === "win" ? "text-win" : "text-loss")}>
        <AnimatedNumber value={delta} format={formatSignedDelta} duration={0.3} />
      </span>
      <span className="text-xs text-muted-foreground">
        wordt <span className="tabular font-semibold text-foreground">{formatRating(rating + delta)}</span>
      </span>
    </div>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col-reverse gap-0.5 bg-card px-2 py-2.5">
      <dt className="text-[0.6875rem] leading-tight text-muted-foreground">{term}</dt>
      <dd className="font-score text-xl">{value}</dd>
    </div>
  );
}

/** Waar de gekozen uitslag valt tussen de kleinste (× 0,75) en grootste (× 1,50) marge. */
function MarginBar({ multiplier }: { multiplier: number }) {
  const MIN = 0.75;
  const MAX = 1.5;
  const pct = ((multiplier - MIN) / (MAX - MIN)) * 100;
  return (
    <div className="flex flex-col gap-1.5" aria-hidden>
      <div className="relative h-2 rounded-full bg-muted">
        <m.div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          initial={false}
          animate={{ width: `${Math.max(4, pct)}%` }}
          transition={transition.base}
        />
        <span className="absolute inset-y-[-3px] left-1/3 w-px bg-foreground/40" />
      </div>
      <div className="relative h-4 text-[0.6875rem] text-muted-foreground">
        <span className="absolute left-0">Nipt</span>
        <span className="absolute left-1/3 -translate-x-1/2">Klassiek</span>
        <span className="absolute right-0">Maximaal</span>
      </div>
    </div>
  );
}

function Segmented({
  legend,
  name,
  value,
  onChange,
  options,
  score = false,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  score?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = option.value === value;
          const inputId = `${id}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={cn(
                "relative inline-flex h-10 cursor-pointer items-center rounded-md border px-3 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                checked ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                score ? "font-score text-lg tracking-wide" : "text-sm font-semibold",
              )}
            >
              <input
                id={inputId}
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
