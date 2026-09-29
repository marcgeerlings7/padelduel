import type { PerspectiveSet } from "@/lib/stats/types";
import { cn } from "@/lib/utils";
import { formatSets } from "./score-entry";

/**
 * Uitslag als mini-scorebord: per set een kolom met eigen games boven en die
 * van de tegenstander onder. De winnaar van elke set staat vet, de verliezer
 * gedimd; een super-tiebreak krijgt het label "tb". Screenreaders krijgen de
 * scoreregel als tekst ("6-4, 3-6, 10-8").
 */
export function SetScoreline({
  sets,
  voided = false,
  size = "md",
  tone = "default",
  className,
}: {
  sets: PerspectiveSet[];
  /** Ongeldig verklaarde uitslag: doorgestreept en gedimd. */
  voided?: boolean;
  size?: "sm" | "md";
  tone?: "default" | "court";
  className?: string;
}) {
  if (sets.length === 0) return null;
  const text = formatSets(sets);
  const hasTiebreak = sets.some((s) => s.isMatchTiebreak);

  return (
    <span className={cn("inline-flex items-stretch", className)}>
      <span className="sr-only">
        {voided ? "Ongeldige uitslag " : "Uitslag "}
        {text}
        {hasTiebreak ? " (laatste set super-tiebreak)" : ""}
      </span>
      <span
        aria-hidden
        className={cn(
          "inline-flex items-stretch divide-x rounded-md border font-score leading-none tabular",
          tone === "default" && "border-border bg-card divide-border",
          tone === "court" && "border-white/15 bg-white/8 divide-white/15",
          voided && "opacity-60",
        )}
      >
        {sets.map((set, index) => {
          const ownWon = set.own > set.opponent;
          return (
            <span
              key={index}
              className={cn(
                "relative flex flex-col items-center justify-center",
                size === "md" ? "min-w-8 gap-1 px-1.5 py-1.5 text-lg" : "min-w-6 gap-0.5 px-1 py-1 text-[0.9375rem]",
                voided && "line-through",
              )}
            >
              <span className={cn(ownWon ? "font-bold" : "opacity-45")}>{set.own}</span>
              <span className={cn(!ownWon ? "font-bold" : "opacity-45")}>{set.opponent}</span>
              {set.isMatchTiebreak ? (
                <span
                  className={cn(
                    "absolute -top-2 right-0.5 rounded-sm px-0.5 font-sans text-[0.5625rem] font-semibold tracking-wide no-underline",
                    tone === "default" ? "bg-card text-muted-foreground" : "bg-court text-court-muted",
                  )}
                >
                  tb
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
    </span>
  );
}
