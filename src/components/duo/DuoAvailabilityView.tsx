"use client";

import { CalendarClock, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/EmptyState";
import { CardSkeleton, ListSkeleton } from "@/components/app/LoadingSkeletons";
import { SectionCard } from "@/components/app/SectionCard";
import { AvailabilityBlockForm } from "@/components/availability/AvailabilityBlockForm";
import { DayPartGrid } from "@/components/availability/DayPartGrid";
import { ResponsiveSheet } from "@/components/availability/ResponsiveSheet";
import { WeekTimeline } from "@/components/availability/WeekTimeline";
import { formatHours, mondayBasedDay, weekSummary } from "@/components/availability/week";
import { Button } from "@/components/ui/button";
import {
  useDuoAvailability,
  type AvailabilityBlock,
  type AvailabilityInput,
} from "@/lib/client/useDuoAvailability";

const DEFAULT_INPUT: Omit<AvailabilityInput, "dayOfWeek"> = { startTime: "19:00", endTime: "21:00", recurring: true };

type SheetState =
  | { mode: "add"; initial: AvailabilityInput; key: number }
  | { mode: "edit"; block: AvailabilityBlock; key: number };

function summaryText(blocks: AvailabilityBlock[]): string {
  const { totalMinutes, days } = weekSummary(blocks);
  return `${formatHours(totalMinutes)} per week, verdeeld over ${days} ${days === 1 ? "dag" : "dagen"}.`;
}

export function DuoAvailabilityView({ duoId }: { duoId: string }) {
  const { blocks, loadError, busyKey, findQuickSlotBlock, toggleQuickSlot, addBlock, updateBlock, removeBlock } =
    useDuoAvailability(duoId);
  // Inhoud en open-status apart, zodat de sheet tijdens het sluiten zijn inhoud houdt.
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Pas na mount bepalen (tijdzone van de gebruiker), zodat SSR en client gelijk blijven.
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => setToday(mondayBasedDay(new Date())), []);

  async function report(result: Promise<string | null>, success?: string) {
    const error = await result;
    setActionError(error);
    if (!error && success) toast.success(success);
  }

  function openAdd(dayOfWeek: number) {
    setSheet({ mode: "add", initial: { dayOfWeek, ...DEFAULT_INPUT }, key: Date.now() });
    setSheetOpen(true);
  }

  function openEdit(block: AvailabilityBlock) {
    setSheet({ mode: "edit", block, key: Date.now() });
    setSheetOpen(true);
  }

  if (loadError) {
    return (
      <div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
        {loadError} Vernieuw de pagina om het opnieuw te proberen.
      </div>
    );
  }

  if (!blocks) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <CardSkeleton lines={7} label="Weekrooster laden" />
        <ListSkeleton rows={4} label="Tijdsblokken laden" />
      </div>
    );
  }

  return (
    <>
      {actionError ? (
        <div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          {actionError}
        </div>
      ) : null}

      <SectionCard
        title="Snelkeuze"
        description="Tik een dagdeel aan om het als vast blok voor elke week op te slaan."
        flush
      >
        <DayPartGrid
          today={today}
          isOn={(day, slot) => Boolean(findQuickSlotBlock(day, slot))}
          isBusy={(day, slot) => busyKey === `slot-${day}-${slot.startTime}`}
          onToggle={(day, slot) => void report(toggleQuickSlot(day, slot))}
        />
      </SectionCard>

      <SectionCard
        title="Alle tijdsblokken"
        description={
          blocks.length > 0 ? summaryText(blocks) : "Voeg vrije tijden toe naast de vaste dagdelen."
        }
        flush
      >
        {blocks.length === 0 ? (
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <EmptyState
              compact
              icon={CalendarClock}
              title="Nog geen beschikbaarheid doorgegeven."
              description="Kies hierboven een dagdeel, of voeg een eigen tijdsblok toe. Tegenstanders zien alleen je duo-naam, regio en tijden."
            />
          </div>
        ) : (
          <>
            <WeekTimeline
              blocks={blocks}
              today={today}
              busyKey={busyKey}
              onAdd={openAdd}
              onEdit={openEdit}
              onDelete={(block) => void report(removeBlock(block.id), "Tijdsblok verwijderd")}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-4 rounded-full bg-primary" />
                Elke week
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-4 rounded-full bg-[repeating-linear-gradient(135deg,var(--primary)_0_3px,color-mix(in_oklab,var(--primary)_35%,transparent)_3px_7px)]"
                />
                Niet vast terugkerend
              </span>
            </div>
          </>
        )}
        <div className="border-t px-4 py-3 sm:px-5">
          <Button type="button" variant="soft" onClick={() => openAdd(today ?? 0)} className="w-full sm:w-fit">
            <Plus aria-hidden />
            Tijdsblok toevoegen
          </Button>
        </div>
      </SectionCard>

      <ResponsiveSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={sheet?.mode === "edit" ? "Tijdsblok bewerken" : "Tijdsblok toevoegen"}
        description="Tegenstanders zien dit blok bij het plannen van een wedstrijd."
      >
        {sheet?.mode === "add" ? (
          <AvailabilityBlockForm
            key={sheet.key}
            initial={sheet.initial}
            submitLabel="Toevoegen"
            busy={busyKey === "add"}
            onCancel={() => setSheetOpen(false)}
            onSubmit={async (input) => {
              const error = await addBlock(input);
              if (!error) {
                setSheetOpen(false);
                toast.success("Tijdsblok toegevoegd");
              }
              return error;
            }}
          />
        ) : sheet?.mode === "edit" ? (
          <AvailabilityBlockForm
            key={sheet.key}
            initial={{
              dayOfWeek: sheet.block.dayOfWeek,
              startTime: sheet.block.startTime,
              endTime: sheet.block.endTime,
              recurring: sheet.block.recurring,
            }}
            submitLabel="Opslaan"
            busy={busyKey === `edit-${sheet.block.id}`}
            onCancel={() => setSheetOpen(false)}
            onSubmit={async (input) => {
              const id = sheet.block.id;
              const error = await updateBlock(id, input);
              if (!error) {
                setSheetOpen(false);
                toast.success("Tijdsblok opgeslagen");
              }
              return error;
            }}
          />
        ) : null}
      </ResponsiveSheet>
    </>
  );
}
