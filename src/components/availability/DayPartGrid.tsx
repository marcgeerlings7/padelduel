"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { Fragment } from "react";
import { DAY_LABELS, QUICK_SLOTS, type QuickSlot } from "@/lib/client/useDuoAvailability";
import { cn } from "@/lib/utils";

/** "08:00" → "08" (hele uren in de kolomkop). */
function hour(time: string): string {
  return time.endsWith(":00") ? time.slice(0, 2) : time;
}

/**
 * Snelkeuze-rooster: 7 dagen × 3 dagdelen. Elke cel is een toggle-knop met
 * toegankelijke naam "<Dag> <Dagdeel>" (bijv. "Dinsdag Avond"); aan = tekst
 * "Beschikbaar" (e2e-contract).
 */
export function DayPartGrid({
  isOn,
  isBusy,
  onToggle,
  today,
}: {
  isOn: (dayOfWeek: number, slot: QuickSlot) => boolean;
  isBusy: (dayOfWeek: number, slot: QuickSlot) => boolean;
  onToggle: (dayOfWeek: number, slot: QuickSlot) => void;
  /** Dagindex van vandaag (0 = maandag), voor een subtiele markering. */
  today: number | null;
}) {
  return (
    <div
      role="group"
      aria-label="Snelkeuze per dagdeel"
      className="grid grid-cols-[3rem_repeat(3,minmax(0,1fr))] gap-1.5 px-3 pb-3 sm:grid-cols-[7.5rem_repeat(3,minmax(0,1fr))] sm:gap-2 sm:px-5 sm:pb-5"
    >
      <div aria-hidden />
      {QUICK_SLOTS.map((slot) => (
        <div key={slot.label} className="flex flex-col items-center pb-1 text-center leading-tight">
          <span className="text-sm font-semibold">{slot.label}</span>
          <span className="font-score text-sm text-muted-foreground">
            {hour(slot.startTime)}–{hour(slot.endTime)}
          </span>
        </div>
      ))}

      {DAY_LABELS.map((dayLabel, dayOfWeek) => {
        const isToday = today === dayOfWeek;
        return (
          <Fragment key={dayLabel}>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "font-display text-lg leading-none font-bold sm:text-xl",
                  isToday ? "text-primary" : "text-foreground",
                )}
              >
                <span aria-hidden className="sm:hidden">
                  {dayLabel.slice(0, 2)}
                </span>
                <span className="sr-only sm:not-sr-only">{dayLabel}</span>
              </span>
              {isToday ? (
                <span className="size-1.5 rounded-full bg-primary" aria-label="vandaag" role="img" />
              ) : null}
            </div>
            {QUICK_SLOTS.map((slot) => {
              const on = isOn(dayOfWeek, slot);
              const busy = isBusy(dayOfWeek, slot);
              return (
                <button
                  key={slot.label}
                  type="button"
                  aria-label={`${dayLabel} ${slot.label}`}
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => onToggle(dayOfWeek, slot)}
                  className={cn(
                    "group flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-snap outline-none active:scale-[0.96] motion-reduce:active:scale-100",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:cursor-progress",
                    on
                      ? "bg-primary text-primary-foreground shadow-card hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--foreground))]"
                      : "border border-dashed border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary-soft hover:text-primary",
                  )}
                >
                  {busy ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : on ? (
                    <Check aria-hidden className="size-4" strokeWidth={3} />
                  ) : (
                    <Plus aria-hidden className="size-4 opacity-60 group-hover:opacity-100" />
                  )}
                  {on ? "Beschikbaar" : ""}
                </button>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
