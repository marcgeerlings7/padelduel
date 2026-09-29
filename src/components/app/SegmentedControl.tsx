"use client";

import { m } from "motion/react";
import { useId, useRef } from "react";
import { transition } from "@/components/app/motion";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  /** Optionele tweede regel (kort). */
  hint?: string;
};

/**
 * Enkelvoudige keuze als gesegmenteerde balk (radiogroep met roving
 * tabindex en pijltjestoetsen). De actieve pill schuift mee (layoutId).
 * `tone="court"` voor gebruik op het blauwe court-vlak.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = "default",
  className,
}: {
  /** Toegankelijke naam van de groep. */
  label: string;
  options: ReadonlyArray<SegmentOption<T>>;
  /** null = nog niets gekozen (eerste optie is dan tabbaar). */
  value: T | null;
  onChange: (value: T) => void;
  tone?: "default" | "court";
  className?: string;
}) {
  const layoutId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % options.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  const court = tone === "court";

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "grid auto-cols-fr grid-flow-col gap-1 rounded-lg p-1",
        court ? "bg-white/10" : "border bg-card shadow-card",
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (selectedIndex < 0 && index === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "relative flex min-h-10 min-w-0 flex-col items-center justify-center rounded-md px-2 py-1.5 text-sm font-semibold transition-colors",
              "focus-visible:ring-[3px] focus-visible:outline-none",
              court ? "focus-visible:ring-ball/70" : "focus-visible:ring-ring/50",
              active
                ? court
                  ? "text-court"
                  : "text-primary-foreground"
                : court
                  ? "text-court-foreground hover:bg-white/10"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <m.span
                layoutId={layoutId}
                transition={transition.spring}
                aria-hidden
                className={cn("absolute inset-0 rounded-md", court ? "bg-court-foreground" : "bg-primary")}
              />
            ) : null}
            <span className="relative max-w-full truncate">{option.label}</span>
            {option.hint ? (
              <span
                className={cn(
                  "relative max-w-full truncate text-[11px] font-medium",
                  active ? (court ? "text-court/80" : "text-primary-foreground/80") : court ? "text-court-muted" : "text-muted-foreground",
                )}
              >
                {option.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
