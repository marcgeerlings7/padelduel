"use client";

import { DuoAvatar } from "@/components/app/DuoAvatar";
import { cn } from "@/lib/utils";

/**
 * Kies welk eigen duo je bekijkt (een gebruiker kan in meerdere actieve duo's
 * zitten). Radiogroep van pills, horizontaal scrollbaar op mobiel.
 */
export function DuoSwitcher({
  duos,
  value,
  onChange,
}: {
  duos: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const index = duos.findIndex((d) => d.id === value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % duos.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + duos.length) % duos.length;
    if (next < 0) return;
    e.preventDefault();
    onChange(duos[next].id);
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
    buttons[next]?.focus();
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <div role="radiogroup" aria-label="Duo" onKeyDown={onKeyDown} className="flex w-max gap-2">
        {duos.map((duo) => {
          const active = duo.id === value;
          return (
            <button
              key={duo.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(duo.id)}
              className={cn(
                "flex h-11 items-center gap-2 rounded-full border py-1 pr-4 pl-1 text-sm font-semibold whitespace-nowrap shadow-card transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                active
                  ? "border-primary bg-primary-soft text-primary"
                  : "bg-card text-foreground hover:bg-accent",
              )}
            >
              <DuoAvatar name={duo.name} size="sm" className="rounded-full" />
              {duo.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
