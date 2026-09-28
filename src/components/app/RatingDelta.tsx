import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSignedDelta } from "./format";

/**
 * Ratingverschil: "+12" groen ↑, "−8" rood ↓, "±0" neutraal.
 * - variant "pill" (default): getinte achtergrond — in lijsten/tabellen.
 * - variant "inline": alleen gekleurde tekst — naast een groot getal.
 * - `forfeit`: forfeit-penalty (vaste straf, geen ELO) — gestreepte rand +
 *   label, zodat hij nooit verward wordt met een gespeelde wedstrijd.
 * - `tone="court"`: op een court-vlak (StatCard emphasis / SectionCard court):
 *   ball-geel/zachtroze i.p.v. groen/rood, want die halen daar geen contrast.
 * Kleur is nooit de enige drager: altijd teken + pijl + sr-only tekst.
 */
export function RatingDelta({
  value,
  variant = "pill",
  forfeit = false,
  size = "sm",
  tone = "default",
  className,
}: {
  value: number;
  variant?: "pill" | "inline";
  forfeit?: boolean;
  size?: "sm" | "md";
  tone?: "default" | "court";
  className?: string;
}) {
  const rounded = Math.round(value);
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  const text = formatSignedDelta(rounded);
  const srText =
    direction === "up"
      ? `${rounded} ratingpunten gewonnen`
      : direction === "down"
        ? `${Math.abs(rounded)} ratingpunten verloren`
        : "rating onveranderd";

  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-0.5 font-semibold whitespace-nowrap tabular",
        size === "sm" ? "text-xs" : "text-sm",
        tone === "default" && [
          direction === "up" && "text-win",
          direction === "down" && "text-loss",
          direction === "flat" && "text-muted-foreground",
        ],
        tone === "court" && [
          direction === "up" && "text-ball",
          direction === "down" && "text-[#ffc2c6]",
          direction === "flat" && "text-court-muted",
        ],
        variant === "pill" && tone === "default" && [
          "rounded-full",
          size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1",
          direction === "up" && "bg-win-soft",
          direction === "down" && "bg-loss-soft",
          direction === "flat" && "bg-muted",
        ],
        variant === "pill" && tone === "court" && ["rounded-full bg-white/12", size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1"],
        forfeit && "border border-dashed border-current",
        className,
      )}
    >
      <Icon aria-hidden className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={2.75} />
      <span aria-hidden>{text}</span>
      {forfeit ? <span aria-hidden className="ml-1 font-medium opacity-80">forfeit</span> : null}
      <span className="sr-only">
        {srText}
        {forfeit ? " (forfeit-penalty)" : ""}
      </span>
    </span>
  );
}
