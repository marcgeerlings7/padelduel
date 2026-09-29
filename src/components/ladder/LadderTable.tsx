"use client";

import { Swords } from "lucide-react";
import { DuoAvatar } from "@/components/app/DuoAvatar";
import { formatRating } from "@/components/app/format";
import { RankBadge } from "@/components/app/RankBadge";
import { TierBadge } from "@/components/app/TierBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReliabilityMeter, StreakChip } from "./DuoStatBits";
import { formatRecord, groupByTier, tierRange, type LadderRow } from "./ladder-model";

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function hasNoRecord(entry: LadderRow): boolean {
  return entry.wins + entry.losses === 0 && entry.reliability.total === 0;
}

export type ChallengeState = {
  /** Het eigen duo dat namens de gebruiker uitdaagt (null = niet ingelogd / geen duo in deze regio). */
  actingDuo: { id: string; tier: number } | null;
  /** Het uitdagende duo heeft al een lopende challenge → knoppen uitgeschakeld. */
  busy: boolean;
  /** Duo-id waarvoor nu een uitdaging wordt verstuurd. */
  pendingId: string | null;
  onChallenge: (duoId: string, duoName: string) => void;
};

/**
 * De ladder als tabel, gegroepeerd per tier. Elke tier is een eigen <tbody>
 * met een tierlabel boven de eerste rij (geen extra <tr>: e2e telt
 * `table tbody tr` = aantal duo's). Op mobiel valt de tabel terug op drie
 * kolommen (positie · duo met meta-regel · rating); vanaf sm verschijnen
 * tier, W–V en reeks als eigen kolommen, vanaf md ook betrouwbaarheid.
 */
export function LadderTable({
  ladder,
  tierSize,
  ownDuoIds,
  regionName,
  challenge,
}: {
  ladder: LadderRow[];
  tierSize: number | null;
  ownDuoIds: ReadonlySet<string>;
  regionName: string;
  challenge: ChallengeState;
}) {
  const groups = groupByTier(ladder);
  const { actingDuo } = challenge;
  const showActions = Boolean(actingDuo);

  return (
    <div className="overflow-x-auto rounded-xl border bg-card text-card-foreground shadow-card">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">
          Ladder {regionName}, gesorteerd op rating. {ladder.length} duo&apos;s, gegroepeerd per tier.
        </caption>
        <thead>
          <tr className="text-xs font-semibold text-muted-foreground">
            <th scope="col" className="w-12 py-2.5 pr-1 pl-4 font-semibold sm:w-16 sm:pl-5">
              <span aria-hidden>#</span>
              <span className="sr-only">Positie</span>
            </th>
            <th scope="col" className="py-2.5 pr-2 font-semibold">
              Duo
            </th>
            <th scope="col" className="hidden w-24 py-2.5 pr-3 font-semibold sm:table-cell">
              Tier
            </th>
            <th scope="col" className="hidden w-16 py-2.5 pr-3 text-right font-semibold sm:table-cell">
              <abbr title="Gewonnen–verloren" className="no-underline">
                W–V
              </abbr>
            </th>
            <th scope="col" className="hidden w-18 py-2.5 pr-3 text-center font-semibold sm:table-cell">
              Reeks
            </th>
            <th scope="col" className="hidden w-32 py-2.5 pr-3 font-semibold md:table-cell">
              Betrouwbaar
            </th>
            <th
              scope="col"
              className={cn(
                "w-18 py-2.5 text-right font-semibold sm:w-22",
                showActions ? "pr-2" : "pr-4 sm:pr-5",
              )}
            >
              Rating
            </th>
            {showActions ? (
              <th scope="col" className="w-13 py-2.5 pr-3 sm:w-36 sm:pr-5">
                <span className="sr-only">Actie</span>
              </th>
            ) : null}
          </tr>
        </thead>
        {groups.map((group) => {
          const range = tierRange(group.tier, tierSize);
          const isActingTier = actingDuo?.tier === group.tier;
          return (
            <tbody key={group.tier} data-tier={group.tier}>
              {group.entries.map((entry, index) => {
                const isOwn = ownDuoIds.has(entry.id);
                const isFirst = index === 0;
                const canChallenge = Boolean(actingDuo) && !isOwn && isActingTier;
                const cell = cn(
                  "border-t align-middle",
                  isFirst ? "border-t-foreground/15 pt-9 pb-3" : "py-3",
                );
                return (
                  <tr
                    key={entry.id}
                    data-own={isOwn || undefined}
                    data-inactive={entry.inactive || undefined}
                    className={cn("transition-colors", isOwn ? "bg-primary-soft/80" : "hover:bg-accent/60")}
                  >
                    <td
                      className={cn(
                        cell,
                        "relative pr-1 pl-4 sm:pl-5",
                        isOwn && "shadow-[inset_3px_0_0_var(--primary)]",
                      )}
                    >
                      {isFirst ? (
                        <div
                          aria-hidden
                          className="absolute top-2.5 left-4 flex items-center gap-2 text-xs whitespace-nowrap sm:left-5"
                        >
                          <span
                            className={cn(
                              "font-display text-[0.9375rem] font-bold tracking-wide",
                              isActingTier ? "text-primary" : "text-foreground",
                            )}
                          >
                            Tier {group.tier}
                          </span>
                          {range ? (
                            <span className="tabular text-muted-foreground">
                              {range.min}–{range.max}
                            </span>
                          ) : null}
                          {isActingTier ? (
                            <span className="rounded-full bg-primary px-2 py-px text-[0.6875rem] font-semibold text-primary-foreground">
                              Jouw tier
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <RankBadge position={entry.position} size="sm" />
                    </td>
                    <td className={cn(cell, "pr-2")}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <DuoAvatar
                          name={entry.name}
                          size="sm"
                          own={isOwn}
                          className={cn(entry.inactive && "opacity-45 grayscale")}
                        />
                        <div className="flex min-w-0 flex-col gap-1">
                          <p className="flex min-w-0 items-center gap-1.5 leading-tight">
                            <span
                              className={cn(
                                "truncate font-semibold",
                                entry.inactive && "text-muted-foreground",
                              )}
                            >
                              {entry.name}
                            </span>
                            {isOwn ? (
                              <>
                                <span className="sr-only"> (jouw duo)</span>
                                <span
                                  aria-hidden
                                  className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[0.6875rem] font-semibold text-primary-foreground"
                                >
                                  Jij
                                </span>
                              </>
                            ) : null}
                            {entry.inactive ? (
                              <span className="hidden shrink-0 rounded-full border border-dashed border-input px-1.5 py-px text-[0.6875rem] font-semibold text-muted-foreground sm:inline">
                                Inactief
                              </span>
                            ) : null}
                          </p>
                          {/* Meta-regel: alleen mobiel (vanaf sm eigen kolommen). */}
                          <p className="flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
                            <span className="sr-only">Tier {entry.tier}. </span>
                            {hasNoRecord(entry) && !entry.inactive ? (
                              <span>Nog geen wedstrijden</span>
                            ) : (
                              <>
                                <span className="tabular font-semibold text-foreground">
                                  <span className="sr-only">Gewonnen–verloren </span>
                                  {formatRecord(entry.wins, entry.losses)}
                                </span>
                                <StreakChip streak={entry.streak} detail={entry.streakDetail} />
                                {entry.inactive ? (
                                  <span
                                    title={`Laatst actief ${dateFormatter.format(new Date(entry.lastActivityAt))}`}
                                    className="rounded-full border border-dashed border-input px-1.5 py-px text-[0.6875rem] font-semibold"
                                  >
                                    Inactief
                                  </span>
                                ) : (
                                  <ReliabilityMeter reliability={entry.reliability} compact />
                                )}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={cn(cell, "hidden pr-3 sm:table-cell")}>
                      <TierBadge tier={entry.tier} />
                    </td>
                    <td className={cn(cell, "hidden pr-3 text-right sm:table-cell")}>
                      <span className="tabular font-semibold">{formatRecord(entry.wins, entry.losses)}</span>
                    </td>
                    <td className={cn(cell, "hidden pr-3 text-center sm:table-cell")}>
                      <StreakChip streak={entry.streak} detail={entry.streakDetail} />
                    </td>
                    <td className={cn(cell, "hidden pr-3 md:table-cell")}>
                      <ReliabilityMeter reliability={entry.reliability} />
                    </td>
                    <td className={cn(cell, "text-right", showActions ? "pr-2" : "pr-4 sm:pr-5")}>
                      <span
                        className={cn(
                          "font-score text-[1.375rem]",
                          entry.inactive && "text-muted-foreground",
                        )}
                      >
                        {formatRating(entry.currentRating)}
                      </span>
                    </td>
                    {showActions ? (
                      <td className={cn(cell, "pr-3 text-right sm:pr-5")}>
                        {canChallenge ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="soft"
                            disabled={challenge.busy || challenge.pendingId !== null}
                            aria-busy={challenge.pendingId === entry.id || undefined}
                            title={challenge.busy ? "Je duo heeft al een actieve challenge" : undefined}
                            onClick={() => challenge.onChallenge(entry.id, entry.name)}
                            className="size-9 px-0 sm:size-auto sm:h-9 sm:px-3"
                          >
                            <Swords aria-hidden />
                            <span className="sr-only sm:not-sr-only">Uitdagen</span>
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
