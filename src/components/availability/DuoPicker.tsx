"use client";

import { DuoAvatar } from "@/components/app/DuoAvatar";
import { cn } from "@/lib/utils";

/** Keuze tussen de eigen duo's als pills (horizontaal scrollbaar op mobiel). */
export function DuoPicker({
  duos,
  selectedId,
  onSelect,
}: {
  duos: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Duo"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {duos.map((duo) => {
        const selected = duo.id === selectedId;
        return (
          <button
            key={duo.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(duo.id)}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-full border pr-4 pl-1.5 text-sm font-semibold transition-colors outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/60",
              selected
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-card text-foreground hover:bg-accent",
            )}
          >
            <DuoAvatar name={duo.name} size="sm" className="rounded-full" />
            {duo.name}
          </button>
        );
      })}
    </div>
  );
}
