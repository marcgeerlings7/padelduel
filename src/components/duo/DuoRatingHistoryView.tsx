"use client";

import { ChevronRight, LineChart as LineChartIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/app/AnimatedNumber";
import { EmptyState } from "@/components/app/EmptyState";
import { formatRating } from "@/components/app/format";
import { ChartSkeleton, StatGridSkeleton, TableSkeleton } from "@/components/app/LoadingSkeletons";
import { RatingChart } from "@/components/app/RatingChart";
import { RatingDelta } from "@/components/app/RatingDelta";
import { toRatingSeries } from "@/components/app/rating-series";
import { SectionCard } from "@/components/app/SectionCard";
import { StatCard } from "@/components/app/StatCard";
import { formatShortDate } from "@/components/matches/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";
import { cn } from "@/lib/utils";

type RatingHistoryEntry = {
  id: string;
  ratingBefore: number;
  ratingAfter: number;
  kFactor: number | null;
  isForfeit: boolean;
  matchId: string | null;
  challengeId: string | null;
  createdAt: string;
  opponentName: string | null;
};

type LadderResponse = {
  tierSize: number;
  ladder: { id: string; position: number; tier: number; currentRating: number }[];
};

type EntryKind = "match" | "forfeit" | "correction";

/**
 * Soort mutatie. Forfeits lopen nooit via ELO; een forfeit-rij met een
 * stijging is een correctie na een toegekende forfeit-dispute.
 * "Wedstrijdresultaat" is e2e-contract (rij = `<tr>` met "1160 → …").
 */
function kindOf(entry: RatingHistoryEntry): EntryKind {
  if (!entry.isForfeit) return "match";
  return entry.ratingAfter >= entry.ratingBefore ? "correction" : "forfeit";
}

const KIND_BADGE: Record<EntryKind, { label: string; variant: "muted" | "loss" | "win" }> = {
  match: { label: "Wedstrijdresultaat", variant: "muted" },
  forfeit: { label: "Forfeit-penalty", variant: "loss" },
  correction: { label: "Forfeit-correctie", variant: "win" },
};

/**
 * Ratinggeschiedenis van één duo: kerngetallen, verloop (Bklit-chart met
 * tier-grenzen) en een tabel met elke mutatie. `regionSlug` (optioneel) haalt
 * tier_size en de ladderpositie op via /api/ladder.
 */
export function DuoRatingHistoryView({ duoId, regionSlug }: { duoId: string; regionSlug?: string }) {
  const router = useRouter();
  const [history, setHistory] = useState<RatingHistoryEntry[] | null>(null);
  const [ladder, setLadder] = useState<LadderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    setHistory(null);
    setError(null);
    apiFetch<RatingHistoryEntry[]>(`/api/duos/${duoId}/rating-history`)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Kon de ratinggeschiedenis niet laden.");
      });
    return () => {
      cancelled = true;
    };
  }, [duoId, router, attempt]);

  useEffect(() => {
    if (!regionSlug) return;
    let cancelled = false;
    // Alleen voor tier-grenzen en positie; zonder deze data werkt de pagina ook.
    apiFetch<LadderResponse>(`/api/ladder?regionSlug=${encodeURIComponent(regionSlug)}`)
      .then((data) => {
        if (!cancelled) setLadder(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [regionSlug]);

  const series = useMemo(() => (history ? toRatingSeries(history) : []), [history]);
  const ladderEntry = ladder?.ladder.find((e) => e.id === duoId) ?? null;

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
        <p>{error}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          Opnieuw proberen
        </Button>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="flex flex-col gap-6">
        <StatGridSkeleton count={3} className="grid grid-cols-2 gap-3 lg:grid-cols-3" />
        <ChartSkeleton aspectRatio="2 / 1" />
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="Nog geen ratingwijzigingen"
        description="De rating verandert zodra een wedstrijd bevestigd is, of bij een forfeit-penalty."
        action={
          <Button asChild>
            <Link href={`/duos/${duoId}/challenges`}>Naar challenges</Link>
          </Button>
        }
      />
    );
  }

  const latest = history[0];
  const current = ladderEntry?.currentRating ?? latest.ratingAfter;
  const ratings = series.map((p) => p.rating);
  const peak = Math.max(...ratings);
  const low = Math.min(...ratings);
  const matchCount = history.filter((e) => !e.isForfeit).length;
  const forfeitCount = history.filter((e) => kindOf(e) === "forfeit").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          emphasis
          label="Huidige rating"
          value={<AnimatedNumber value={current} />}
          delta={<RatingDelta value={latest.ratingAfter - latest.ratingBefore} variant="inline" tone="court" forfeit={latest.isForfeit} />}
          hint={
            ladderEntry && ladder
              ? `Positie ${ladderEntry.position} in de ladder, tier ${ladderEntry.tier}`
              : undefined
          }
          className="col-span-2 lg:col-span-1"
        />
        <StatCard label="Hoogste" value={formatRating(peak)} hint={`Laagste ${formatRating(low)}`} />
        <StatCard
          label="Wedstrijden"
          value={matchCount}
          hint={forfeitCount > 0 ? `${forfeitCount} forfeit-penalty${forfeitCount === 1 ? "" : "'s"}` : "Geen forfeits"}
        />
      </div>

      <SectionCard
        title="Verloop"
        description={
          ladder
            ? `Stippellijnen markeren de tier-grenzen (elke ${ladder.tierSize} punten).`
            : "Rating na elke wijziging."
        }
      >
        <RatingChart data={series} tierSize={ladder?.tierSize} aspectRatio="2 / 1" />
      </SectionCard>

      <SectionCard
        title="Alle wijzigingen"
        description="Nieuwste bovenaan. Forfeits zijn vaste straffen, geen ELO-berekening."
        flush
        action={
          <Button variant="soft" size="sm" asChild>
            <Link href={`/duos/${duoId}/matches`}>
              Wedstrijden
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="max-md:sr-only">
              <tr className="border-y bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <th scope="col" className="px-5 py-2.5 font-semibold">Datum</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Tegen</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Soort</th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">Wijziging</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => {
                const kind = kindOf(entry);
                const badge = KIND_BADGE[kind];
                const delta = entry.ratingAfter - entry.ratingBefore;
                return (
                  <tr
                    key={entry.id}
                    data-kind={kind}
                    className={cn(
                      "border-t first:border-t-0 md:first:border-t",
                      "max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-1.5 max-md:px-4 max-md:py-3",
                      kind !== "match" && "bg-[repeating-linear-gradient(135deg,transparent_0_8px,color-mix(in_oklab,var(--muted)_70%,transparent)_8px_9px)]",
                    )}
                  >
                    <td className="text-xs whitespace-nowrap text-muted-foreground max-md:col-start-1 max-md:row-start-2 md:px-5 md:py-3 md:text-sm">
                      <time dateTime={entry.createdAt}>{formatShortDate(entry.createdAt)}</time>
                    </td>
                    <td className="min-w-0 truncate font-semibold max-md:col-span-2 max-md:col-start-1 max-md:row-start-1 md:px-3 md:py-3">
                      {entry.opponentName ?? "—"}
                    </td>
                    <td className="max-md:col-start-2 max-md:row-start-2 md:px-3 md:py-3">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className="text-right max-md:col-start-3 max-md:row-span-2 max-md:row-start-1 md:px-5 md:py-3">
                      <div className="flex flex-col items-end gap-1">
                        <RatingDelta value={delta} forfeit={entry.isForfeit} size="md" />
                        <span className="text-xs whitespace-nowrap text-muted-foreground tabular">
                          {formatRating(entry.ratingBefore)} → {formatRating(entry.ratingAfter)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
