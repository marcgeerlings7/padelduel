import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Eén kerngetal met label. Gebruik in een grid van 2 (mobiel) tot 4 (desktop):
 *   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">…</div>
 *
 *   <StatCard label="Rating" value={<AnimatedNumber value={1395} />}
 *             delta={<RatingDelta value={+12} variant="inline" />}
 *             trailing={<RatingSparkline data={history} />} />
 *
 * `value` is een ReactNode zodat je AnimatedNumber, RankBadge of tekst kunt geven;
 * het wordt in de scorebord-letter (font-score) gezet.
 */
export function StatCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  trailing,
  emphasis = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  /** Rechterkant, bijv. een RatingSparkline (max ~96px breed). */
  trailing?: ReactNode;
  /** Court-vlak i.p.v. card — voor maximaal één hoofdgetal per scherm. */
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-end justify-between gap-3 rounded-xl p-4",
        emphasis
          ? "bg-court text-court-foreground shadow-raised"
          : "border bg-card text-card-foreground shadow-card",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs font-semibold",
            emphasis ? "text-court-muted" : "text-muted-foreground",
          )}
        >
          {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
          {label}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-score text-[2.25rem]">{value}</span>
          {delta}
        </div>
        {hint ? (
          <p className={cn("text-xs", emphasis ? "text-court-muted" : "text-muted-foreground")}>{hint}</p>
        ) : null}
      </div>
      {trailing ? <div className="w-24 shrink-0">{trailing}</div> : null}
    </div>
  );
}
