"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DAY_LABELS, QUICK_SLOTS, type AvailabilityBlock } from "@/lib/client/useDuoAvailability";
import { cn } from "@/lib/utils";
import { barPosition, groupByDay, trackRange, type TrackRange } from "./week";

const STRIPES =
  "bg-[repeating-linear-gradient(135deg,var(--primary)_0_3px,color-mix(in_oklab,var(--primary)_35%,transparent)_3px_7px)]";

/** Naam van het snelkeuze-dagdeel als een blok daar exact mee overeenkomt. */
function quickSlotName(block: AvailabilityBlock): string | null {
  const slot = QUICK_SLOTS.find((s) => s.startTime === block.startTime && s.endTime === block.endTime);
  return slot ? slot.label : null;
}

function hourLabel(minutes: number): string {
  return String(Math.floor(minutes / 60)).padStart(2, "0");
}

function ticks(range: TrackRange): number[] {
  const out: number[] = [];
  for (let m = Math.ceil(range.startMinutes / 360) * 360; m <= range.endMinutes; m += 360) out.push(m);
  if (out[0] !== range.startMinutes) out.unshift(range.startMinutes);
  return out;
}

function Track({ blocks, range }: { blocks: AvailabilityBlock[]; range: TrackRange }) {
  const span = range.endMinutes - range.startMinutes;
  return (
    <div aria-hidden className="relative h-3 overflow-hidden rounded-full bg-muted">
      {ticks(range)
        .slice(1, -1)
        .map((m) => (
          <span
            key={m}
            className="absolute inset-y-0 w-px bg-border"
            style={{ left: `${((m - range.startMinutes) / span) * 100}%` }}
          />
        ))}
      {blocks.map((b) => {
        const pos = barPosition(b, range);
        return (
          <span
            key={b.id}
            className={cn("absolute inset-y-0 rounded-full", b.recurring ? "bg-primary" : STRIPES)}
            style={{ left: `${pos.left}%`, width: `max(${pos.width}%, 6px)` }}
          />
        );
      })}
    </div>
  );
}

/**
 * Week-agenda: per dag een tijdlijn met alle blokken, en daaronder de blokken
 * als lijst-items met bewerken/verwijderen. Elk `<li>` bevat de volledige
 * tekst "<Dag> <van>–<tot>" (dag visueel verborgen; e2e-contract).
 */
export function WeekTimeline({
  blocks,
  today,
  busyKey,
  onAdd,
  onEdit,
  onDelete,
}: {
  blocks: AvailabilityBlock[];
  today: number | null;
  busyKey: string | null;
  onAdd: (dayOfWeek: number) => void;
  onEdit: (block: AvailabilityBlock) => void;
  onDelete: (block: AvailabilityBlock) => void;
}) {
  const range = trackRange(blocks);
  const byDay = groupByDay(blocks);
  const span = range.endMinutes - range.startMinutes;

  return (
    <div className="flex flex-col">
      {/* As met uurlabels, uitgelijnd op de tijdlijnkolom. */}
      <div
        aria-hidden
        className="grid grid-cols-[3rem_minmax(0,1fr)_2.5rem] gap-x-3 px-4 pb-1 sm:grid-cols-[7.5rem_minmax(0,1fr)_2.5rem] sm:px-5"
      >
        <span />
        <div className="relative h-4">
          {ticks(range).map((m, i, all) => (
            <span
              key={m}
              className={cn(
                "absolute top-0 font-score text-xs text-muted-foreground",
                i === 0 ? "translate-x-0" : i === all.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${((m - range.startMinutes) / span) * 100}%` }}
            >
              {hourLabel(m)}
            </span>
          ))}
        </div>
        <span />
      </div>

      {byDay.map((dayBlocks, dayOfWeek) => {
        const dayLabel = DAY_LABELS[dayOfWeek]!;
        const isToday = today === dayOfWeek;
        const headingId = `dag-${dayOfWeek}`;
        return (
          <div
            key={dayLabel}
            role="group"
            aria-labelledby={headingId}
            className="grid grid-cols-[3rem_minmax(0,1fr)_2.5rem] items-center gap-x-3 border-t px-4 py-2.5 sm:grid-cols-[7.5rem_minmax(0,1fr)_2.5rem] sm:px-5"
          >
            <h3
              id={headingId}
              className={cn(
                "font-display text-lg leading-none font-bold sm:text-xl",
                isToday ? "text-primary" : dayBlocks.length === 0 ? "text-muted-foreground" : "text-foreground",
              )}
            >
              <span aria-hidden className="sm:hidden">
                {dayLabel.slice(0, 2)}
              </span>
              <span className="sr-only sm:not-sr-only">{dayLabel}</span>
            </h3>
            <Track blocks={dayBlocks} range={range} />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${dayLabel}: tijdsblok toevoegen`}
              onClick={() => onAdd(dayOfWeek)}
              className="justify-self-end text-muted-foreground hover:text-primary"
            >
              <Plus />
            </Button>

            {dayBlocks.length > 0 ? (
              <ul className="col-span-3 mt-2 flex flex-col gap-1.5 sm:col-span-2 sm:col-start-2">
                {dayBlocks.map((block) => {
                  const slotName = quickSlotName(block);
                  const deleting = busyKey === `delete-${block.id}`;
                  return (
                    <li
                      key={block.id}
                      data-availability-block={`${dayLabel} ${block.startTime}–${block.endTime}`}
                      className="flex items-center gap-2 rounded-lg bg-muted/50 py-1.5 pr-1.5 pl-3"
                    >
                      <span
                        aria-hidden
                        className={cn("h-7 w-1 shrink-0 rounded-full", block.recurring ? "bg-primary" : STRIPES)}
                      />
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-score text-xl leading-none">
                          <span className="sr-only">{dayLabel} </span>
                          {block.startTime}–{block.endTime}
                        </span>
                        {slotName ? <span className="text-xs text-muted-foreground">{slotName}</span> : null}
                        <Badge variant={block.recurring ? "soft" : "outline"}>
                          {block.recurring ? "Elke week" : "Niet vast terugkerend"}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Bewerken"
                        title="Bewerken"
                        onClick={() => onEdit(block)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Verwijderen"
                        title="Verwijderen"
                        disabled={deleting}
                        onClick={() => onDelete(block)}
                        className="hover:bg-loss-soft hover:text-loss"
                      >
                        {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
