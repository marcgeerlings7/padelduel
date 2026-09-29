import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Page } from "@/components/app/Page";

const FACTS = [
  "Uitdagen binnen je eigen tier",
  "ELO-rating die ook het gamesaldo meeweegt",
  "Met meerdere vaste partners tegelijk",
];

/**
 * Schil voor login, registratie en activatie.
 * - Mobiel: alleen het formulier, direct bovenaan (de app-bar toont het merk al).
 * - ≥ lg: court-vlak links met wat de ladder is, formulier rechts.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Page width="wide" className="lg:min-h-dvh lg:justify-center lg:py-10">
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch lg:gap-12">
        <aside
          aria-hidden
          className="court-lines relative hidden flex-col justify-end gap-6 overflow-hidden rounded-2xl bg-court p-10 text-court-foreground shadow-raised lg:flex lg:min-h-[560px]"
        >
          <p className="font-display text-6xl leading-[0.88] font-bold tracking-tight italic xl:text-7xl">
            Elke wedstrijd telt op de ladder.
          </p>
          <ul className="flex flex-col gap-2.5 text-court-muted">
            {FACTS.map((fact) => (
              <li key={fact} className="flex items-center gap-2.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-ball text-ball-foreground">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {fact}
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex items-center justify-center">
          <div className="flex w-full max-w-sm flex-col gap-6">{children}</div>
        </div>
      </div>
    </Page>
  );
}
