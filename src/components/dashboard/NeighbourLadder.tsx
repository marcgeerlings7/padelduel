import { formatRating } from "@/components/app/format";
import { RankBadge } from "@/components/app/RankBadge";
import { ratingGap, type LadderRow } from "@/components/ladder/ladder-model";
import { cn } from "@/lib/utils";
import type { DashboardDuo } from "./types";

/**
 * Mini-ladder: de (max. 3) duo's direct boven en onder het eigen duo, met het
 * puntenverschil. Buren komen kant-en-klaar uit /api/dashboard.
 */
export function NeighbourLadder({
  duo,
  above,
  below,
}: {
  duo: DashboardDuo;
  above: LadderRow[];
  below: LadderRow[];
}) {
  const next = above[above.length - 1];

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col overflow-hidden rounded-lg border bg-card">
        {above.map((entry) => (
          <NeighbourRow key={entry.id} entry={entry} gap={ratingGap(duo.currentRating, entry.currentRating)} dir="up" />
        ))}
        <li
          aria-current="true"
          className="flex items-center gap-2.5 bg-primary-soft px-3 py-2 shadow-[inset_3px_0_0_var(--primary)] [&:not(:first-child)]:border-t"
        >
          <RankBadge position={duo.position} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{duo.name}</span>
          <span aria-hidden className="w-10" />
          <span className="w-10 text-right font-score text-lg">{formatRating(duo.currentRating)}</span>
        </li>
        {below.map((entry) => (
          <NeighbourRow
            key={entry.id}
            entry={entry}
            gap={ratingGap(duo.currentRating, entry.currentRating)}
            dir="down"
          />
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {next ? (
          <>
            Nog <span className="tabular font-semibold text-foreground">{ratingGap(duo.currentRating, next.currentRating)}</span>{" "}
            {ratingGap(duo.currentRating, next.currentRating) === 1 ? "punt" : "punten"} tot plek {next.position} (
            {next.name}).
          </>
        ) : duo.ladderSize > 1 ? (
          <>Je staat bovenaan in {duo.regionName}. Verdedig je plek.</>
        ) : (
          <>Jullie zijn nog het enige duo in {duo.regionName}.</>
        )}
      </p>
    </div>
  );
}

function NeighbourRow({ entry, gap, dir }: { entry: LadderRow; gap: number; dir: "up" | "down" }) {
  return (
    <li className={cn("flex items-center gap-2.5 px-3 py-2 [&:not(:first-child)]:border-t", entry.inactive && "opacity-70")}>
      <RankBadge position={entry.position} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm">{entry.name}</span>
      <span className="tabular w-10 text-right text-xs text-muted-foreground">
        <span aria-hidden>{dir === "up" ? `+${gap}` : `−${gap}`}</span>
        <span className="sr-only">{dir === "up" ? `${gap} punten hoger` : `${gap} punten lager`}</span>
      </span>
      <span className="w-10 text-right font-score text-lg">{formatRating(entry.currentRating)}</span>
    </li>
  );
}
