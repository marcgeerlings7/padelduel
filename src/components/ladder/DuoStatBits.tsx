import { cn } from "@/lib/utils";
import {
  describeReliability,
  describeStreak,
  formatReliability,
  type Reliability,
  type StreakDetail,
} from "./ladder-model";

/**
 * Reeks als scorebord-chip: "W3" groen, "L2" rood, "—" neutraal.
 * Het API-contract ("W3"/"L2"/"—") wordt letterlijk getoond; de voorleestekst
 * zegt het voluit, kleur is nooit de enige drager.
 */
export function StreakChip({
  streak,
  detail,
  className,
}: {
  streak: string;
  detail: StreakDetail | null;
  className?: string;
}) {
  const tone = detail?.result === "W" ? "win" : detail?.result === "L" ? "loss" : "none";
  return (
    <span
      title={describeStreak(detail)}
      className={cn(
        "inline-flex h-5 min-w-8 items-center justify-center rounded-sm px-1.5 font-score text-[0.9375rem]",
        tone === "win" && "bg-win-soft text-win",
        tone === "loss" && "bg-loss-soft text-loss",
        tone === "none" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden>{streak}</span>
      <span className="sr-only">{describeStreak(detail)}</span>
    </span>
  );
}

/**
 * Betrouwbaarheid (gespeelde challenges / gespeeld + eigen forfeits) als
 * percentage met een dunne meter. `compact` = alleen het getal met een
 * minimeter ernaast (mobiele meta-regel).
 */
export function ReliabilityMeter({
  reliability,
  compact = false,
  className,
}: {
  reliability: Reliability;
  compact?: boolean;
  className?: string;
}) {
  const pct = reliability.percentage;
  const tone = pct === null ? "none" : pct >= 90 ? "good" : pct >= 70 ? "ok" : "low";
  return (
    <span
      title={describeReliability(reliability)}
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      <span
        aria-hidden
        className={cn("relative h-1.5 overflow-hidden rounded-full bg-muted", compact ? "w-6" : "w-10")}
      >
        {pct !== null ? (
          <span
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              tone === "good" && "bg-win",
              tone === "ok" && "bg-warning",
              tone === "low" && "bg-loss",
            )}
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        ) : null}
      </span>
      <span aria-hidden className="tabular text-xs font-semibold text-foreground">
        {formatReliability(reliability)}
      </span>
      <span className="sr-only">{describeReliability(reliability)}</span>
    </span>
  );
}
