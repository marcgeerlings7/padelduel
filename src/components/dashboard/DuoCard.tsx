"use client";

import { CalendarClock, History, ListOrdered, Moon, Swords, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { DuoAvatar } from "@/components/app/DuoAvatar";
import { formatRating, formatSignedDelta } from "@/components/app/format";
import { RankBadge } from "@/components/app/RankBadge";
import { RatingDelta } from "@/components/app/RatingDelta";
import { RatingSparkline } from "@/components/app/RatingChart";
import { toRatingSeries } from "@/components/app/rating-series";
import { TierBadge } from "@/components/app/TierBadge";
import { ChartSkeleton } from "@/components/app/LoadingSkeletons";
import { ReliabilityMeter, StreakChip } from "@/components/ladder/DuoStatBits";
import { formatRecord } from "@/components/ladder/ladder-model";
import { cn } from "@/lib/utils";
import { NeighbourLadder } from "./NeighbourLadder";
import type { DashboardDuoCard, RatingHistoryRow } from "./types";

const shortDate = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });
const dateFormatter =new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });

/** null = laden, "error" = mislukt (sparkline valt dan weg; geen harde fout). */
export type HistoryState = RatingHistoryRow[] | null | "error";

/**
 * Eén duo op het dashboard. De <section> bevat naam, cijfers en de links
 * (e2e zoekt `section` met de duonaam en daarbinnen de links); de buren op
 * de ladder staan bewust in een <aside> ernaast, zodat andere duonamen niet
 * in die section vallen.
 */
export function DuoCard({ card, history }: { card: DashboardDuoCard; history: HistoryState }) {
  const { duo } = card;
  const titleId = `duo-${duo.id}-title`;
  const series = Array.isArray(history) ? toRatingSeries(history) : [];
  const latest = Array.isArray(history) && history.length > 0 ? history[0] : null;

  return (
    <article className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl border bg-card text-card-foreground shadow-card lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-5 p-4 sm:p-5">
        {/* Kop: wapen, naam, partner, positie */}
        <header className="flex items-start gap-3">
          <DuoAvatar name={duo.name} size="lg" className={cn(duo.inactive && "opacity-50 grayscale")} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="truncate font-display text-[1.625rem] leading-none font-bold">
              {duo.name}
            </h2>
            {duo.partnerName ? (
              <p className="truncate text-sm text-muted-foreground">
                Met <span className="text-foreground">{duo.partnerName}</span>
              </p>
            ) : null}
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <TierBadge tier={duo.tier} />
              <span className="text-xs text-muted-foreground">{duo.regionName}</span>
              {duo.inactive ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-input px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  <Moon aria-hidden className="size-3" />
                  Inactief
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <RankBadge position={duo.position} size="lg" />
            <span className="text-xs text-muted-foreground">van {duo.ladderSize}</span>
          </div>
        </header>

        {/* Rating + verloop */}
        <div className="flex items-end justify-between gap-4 rounded-lg bg-muted/60 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-semibold text-muted-foreground">Rating</p>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-score text-[2.75rem]">{formatRating(duo.currentRating)}</span>
              {latest ? (
                <RatingDelta value={latest.ratingAfter - latest.ratingBefore} forfeit={latest.isForfeit} />
              ) : null}
            </div>
            {latest ? (
              <p className="text-xs text-muted-foreground">
                Laatste mutatie{latest.opponentName ? ` tegen ${latest.opponentName}` : ""}
              </p>
            ) : null}
          </div>
          <div className="w-28 shrink-0 sm:w-36">
            {history === null ? (
              <ChartSkeleton aspectRatio="3 / 1" label="Ratingverloop laden…" />
            ) : series.length >= 2 ? (
              <RatingSparkline
                data={series}
                label={`Ratingverloop ${duo.name}: van ${formatRating(series[0].rating)} naar ${formatRating(
                  series[series.length - 1].rating,
                )} (${formatSignedDelta(series[series.length - 1].rating - series[0].rating)})`}
              />
            ) : history === "error" ? null : (
              <p className="text-right text-xs text-muted-foreground">Nog geen verloop</p>
            )}
          </div>
        </div>

        {/* Kerngetallen */}
        <dl className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-6">
          <Stat label="W–V">
            <span className="font-score text-2xl">{formatRecord(duo.wins, duo.losses)}</span>
          </Stat>
          <Stat label="Reeks">
            <StreakChip streak={duo.streak} detail={duo.streakDetail} className="h-6 text-lg" />
          </Stat>
          <Stat label="Betrouwbaar">
            <ReliabilityMeter reliability={duo.reliability} className="h-6 [&>span:nth-child(2)]:text-sm" />
          </Stat>
          <Stat label="Setsaldo">
            <span className="font-score text-2xl">{formatSignedDelta(duo.setDifference)}</span>
          </Stat>
          <Stat label="Gamesaldo">
            <span className="font-score text-2xl">{formatSignedDelta(duo.gameDifference)}</span>
          </Stat>
          <Stat label="Laatst actief">
            <span className="text-sm font-semibold">{shortDate.format(new Date(duo.lastActivityAt))}</span>
          </Stat>
        </dl>

        {duo.inactive ? (
          <p className="rounded-lg border border-dashed border-input px-3 py-2.5 text-sm text-muted-foreground">
            Laatst actief op {dateFormatter.format(new Date(duo.lastActivityAt))}. Speel een wedstrijd om weer als
            actief te tellen.
          </p>
        ) : null}

        {/* Snelkoppelingen (linkteksten zijn e2e-contract) */}
        <nav aria-label={`Snelkoppelingen ${duo.name}`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickLink href={`/duos/${duo.id}/challenges`} icon={Swords} primary>
            Challenges bekijken
          </QuickLink>
          <QuickLink href={`/duos/${duo.id}/matches`} icon={History}>
            Wedstrijden
          </QuickLink>
          <QuickLink href={`/duos/${duo.id}/rating-history`} icon={TrendingUp}>
            Ratinggeschiedenis
          </QuickLink>
          <QuickLink href={`/duos/${duo.id}/availability`} icon={CalendarClock}>
            Beschikbaarheid
          </QuickLink>
        </nav>
      </section>

      <aside
        aria-label={`${duo.name} op de ladder van ${duo.regionName}`}
        className="flex flex-col gap-3 border-t bg-background/60 p-4 sm:p-5 lg:border-t-0 lg:border-l"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <ListOrdered aria-hidden className="size-4 text-muted-foreground" />
            Buren op de ladder
          </p>
          <Link
            href="/ladder"
            className="shrink-0 rounded-sm text-sm font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline"
          >
            Hele ladder
          </Link>
        </div>
        <NeighbourLadder duo={duo} above={card.above} below={card.below} />
      </aside>
    </article>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="flex h-7 items-center leading-none">
        <span>{children}</span>
      </dd>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  primary = false,
  children,
}: {
  href: string;
  icon: LucideIcon;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-16 flex-col items-start justify-center gap-1.5 rounded-md px-3 py-2.5 text-[0.8125rem] font-semibold no-underline transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98] motion-reduce:active:scale-100",
        primary
          ? "bg-primary text-primary-foreground shadow-card hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--foreground))]"
          : "border bg-card text-foreground hover:bg-accent",
      )}
    >
      <Icon aria-hidden className={cn("size-4 shrink-0", primary ? "" : "text-primary")} />
      <span className="min-w-0 leading-tight">{children}</span>
    </Link>
  );
}
