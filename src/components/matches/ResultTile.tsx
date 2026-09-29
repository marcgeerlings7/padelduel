import { cn } from "@/lib/utils";

export type TileResult = "W" | "L" | "forfeit" | "voided";

const LABELS: Record<TileResult, { text: string; sr: string }> = {
  W: { text: "W", sr: "Gewonnen" },
  L: { text: "V", sr: "Verloren" },
  forfeit: { text: "F", sr: "Forfeit" },
  voided: { text: "—", sr: "Ongeldig verklaard" },
};

/** Uitslagtegel voor een wedstrijdrij: W(inst), V(erlies), F(orfeit) of — (ongeldig). */
export function ResultTile({ result, size = "md", className }: { result: TileResult; size?: "sm" | "md"; className?: string }) {
  const label = LABELS[result];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-score leading-none",
        size === "md" ? "size-10 text-2xl" : "size-8 text-xl",
        result === "W" && "bg-win-soft text-win",
        result === "L" && "bg-loss-soft text-loss",
        result === "forfeit" && "border border-dashed border-loss/60 text-loss",
        result === "voided" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden>{label.text}</span>
      <span className="sr-only">{label.sr}</span>
    </span>
  );
}
