import { cn } from "@/lib/utils";

/**
 * Rating-tier (afgeleid: floor(rating / tier_size) — nooit zelf berekenen met
 * een hardcoded tier_size; gebruik de waarde uit de API).
 * Het glyph toont drie treden van een ladder; het aantal gevulde treden
 * loopt mee met de tier (1, 2, 3+), puur visueel — de tekst draagt de info.
 */
export function TierBadge({
  tier,
  variant = "default",
  className,
}: {
  tier: number;
  /** "court": op een court-vlak (SectionCard variant="court"). */
  variant?: "default" | "court";
  className?: string;
}) {
  const filled = Math.max(1, Math.min(3, tier));
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-2 text-xs font-semibold whitespace-nowrap",
        variant === "default" && "border bg-card text-foreground",
        variant === "court" && "bg-white/12 text-court-foreground",
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 12 12" className="size-3">
        {[0, 1, 2].map((step) => (
          <rect
            key={step}
            x={step * 4}
            y={8 - step * 3}
            width="3"
            height={4 + step * 3}
            rx="0.75"
            fill="currentColor"
            opacity={step < filled ? 1 : 0.25}
          />
        ))}
      </svg>
      Tier <span className="tabular">{tier}</span>
    </span>
  );
}
