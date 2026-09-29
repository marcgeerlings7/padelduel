"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAY_LABELS, type AvailabilityInput } from "@/lib/client/useDuoAvailability";
import { cn } from "@/lib/utils";

/**
 * Formulier voor een vrij tijdsblok (toevoegen of bewerken) in een sheet.
 * Puur presentatie + lokale formulierstate; validatie en API-calls zitten in
 * useDuoAvailability (onSubmit geeft een foutmelding of null terug).
 */
export function AvailabilityBlockForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: AvailabilityInput;
  submitLabel: string;
  busy: boolean;
  onSubmit: (input: AvailabilityInput) => Promise<string | null>;
  onCancel: () => void;
}) {
  const id = useId();
  const [input, setInput] = useState<AvailabilityInput>(initial);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await onSubmit(input);
    if (result) setError(result);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-day`}>Dag</Label>
        <div className="relative">
          <select
            id={`${id}-day`}
            value={input.dayOfWeek}
            onChange={(e) => setInput((prev) => ({ ...prev, dayOfWeek: Number(e.target.value) }))}
            className={cn(
              "h-12 w-full appearance-none rounded-md border border-input bg-card pr-10 pl-3 text-base font-medium shadow-xs outline-none dark:bg-input/30",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            )}
          >
            {DAY_LABELS.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-start`}>Van</Label>
          <Input
            id={`${id}-start`}
            type="time"
            required
            value={input.startTime}
            onChange={(e) => setInput((prev) => ({ ...prev, startTime: e.target.value }))}
            className="h-12 font-score text-2xl tracking-wide sm:h-12 md:text-2xl"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-end`}>Tot</Label>
          <Input
            id={`${id}-end`}
            type="time"
            required
            value={input.endTime}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => setInput((prev) => ({ ...prev, endTime: e.target.value }))}
            className="h-12 font-score text-2xl tracking-wide sm:h-12 md:text-2xl"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/40 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor={`${id}-recurring`} className="cursor-pointer">
            Vast terugkerend (elke week)
          </Label>
          <p id={`${id}-recurring-hint`} className="text-xs text-muted-foreground">
            Uit: dit tijdstip past soms, maar niet elke week.
          </p>
        </div>
        {/* Native checkbox als switch: robuust voor toetsenbord, formulieren en tests. */}
        <input
          id={`${id}-recurring`}
          type="checkbox"
          role="switch"
          checked={input.recurring}
          aria-describedby={`${id}-recurring-hint`}
          onChange={(e) => setInput((prev) => ({ ...prev, recurring: e.target.checked }))}
          className={cn(
            "relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-input/60 transition-colors outline-none",
            "before:absolute before:top-0.5 before:left-0.5 before:size-6 before:rounded-full before:bg-card before:shadow-card before:transition-transform before:content-['']",
            "checked:bg-primary checked:before:translate-x-5",
            "focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:before:transition-none",
          )}
        />
      </div>

      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
        <Button type="submit" size="lg" disabled={busy} className="sm:flex-1">
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {submitLabel}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={onCancel} className="sm:flex-1">
          Annuleren
        </Button>
      </div>
    </form>
  );
}
