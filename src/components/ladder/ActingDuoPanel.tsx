"use client";

import { Swords } from "lucide-react";
import Link from "next/link";
import { formatRating } from "@/components/app/format";
import { TierBadge } from "@/components/app/TierBadge";
import { cn } from "@/lib/utils";
import type { LadderRow } from "./ladder-model";
import { NativeSelect } from "./NativeSelect";

/**
 * Het court-vlak van de ladderpagina: waar staat het duo waarmee je uitdaagt,
 * en wie kun je nu uitdagen. Bevat (bij meerdere eigen duo's in deze regio)
 * de keuzelijst "Uitdagen namens" — dat moet de tweede <select> op de pagina
 * blijven (na "Regio"), e2e-tests kiezen hem via `select.nth(1)`.
 */
export function ActingDuoPanel({
  ownDuos,
  actingDuoId,
  onActingDuoChange,
  entry,
  ladderSize,
  challengeableCount,
  busy,
}: {
  ownDuos: { id: string; name: string }[];
  actingDuoId: string;
  onActingDuoChange: (id: string) => void;
  /** Ladderrij van het uitdagende duo (null zolang de ladder laadt). */
  entry: LadderRow | null;
  ladderSize: number;
  challengeableCount: number;
  busy: boolean;
}) {
  const name = ownDuos.find((d) => d.id === actingDuoId)?.name ?? entry?.name ?? "";

  let status: React.ReactNode;
  if (!entry) {
    status = null;
  } else if (busy) {
    status = (
      <>
        {name} heeft al een lopende challenge. Uitdagen kan weer zodra die is afgerond.{" "}
        <Link
          href={`/duos/${actingDuoId}/challenges`}
          className="font-semibold text-court-foreground underline underline-offset-4"
        >
          Naar de challenge
        </Link>
      </>
    );
  } else if (challengeableCount === 0) {
    status = (
      <>
        Er staat nu geen ander duo in Tier {entry.tier}. Zodra er een duo in jouw tier komt, kun je het hier
        uitdagen.
      </>
    );
  } else {
    status = (
      <>
        Je kunt {challengeableCount === 1 ? "1 duo" : `${challengeableCount} duo's`} in Tier {entry.tier}{" "}
        uitdagen via de knop met de gekruiste rackets naast hun naam.
      </>
    );
  }

  return (
    <section
      aria-labelledby="acting-duo-title"
      className="court-lines relative overflow-hidden rounded-2xl bg-court p-4 text-court-foreground shadow-raised sm:p-5"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-xs font-semibold text-court-muted">Jij daagt uit met</p>
          <h2 id="acting-duo-title" className="truncate font-display text-2xl leading-none font-bold sm:text-[1.75rem]">
            {name}
          </h2>
          {entry ? <TierBadge tier={entry.tier} variant="court" /> : null}
        </div>

        {entry ? (
          <dl className="flex shrink-0 items-end gap-4 sm:gap-6">
            <div className="flex flex-col items-end gap-1">
              <dt className="text-xs font-semibold text-court-muted">Positie</dt>
              <dd className="flex items-baseline gap-1">
                <span
                  className={cn("font-score text-[2.25rem] sm:text-[2.75rem]", entry.position === 1 && "text-ball")}
                >
                  {entry.position}
                </span>
                <span className="text-xs text-court-muted">/{ladderSize}</span>
              </dd>
            </div>
            <div className="flex flex-col items-end gap-1">
              <dt className="text-xs font-semibold text-court-muted">Rating</dt>
              <dd className="font-score text-[2.25rem] sm:text-[2.75rem]">{formatRating(entry.currentRating)}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      {ownDuos.length > 1 ? (
        <div className="mt-3 grid gap-1.5 sm:max-w-xs">
          <label htmlFor="acting-duo" className="text-xs font-semibold text-court-muted">
            Uitdagen namens
          </label>
          <NativeSelect
            id="acting-duo"
            value={actingDuoId}
            onChange={(e) => onActingDuoChange(e.target.value)}
            className="[&_select]:border-white/25 [&_select]:bg-white/10 [&_select]:text-court-foreground [&_svg]:text-court-muted"
          >
            {ownDuos.map((d) => (
              <option key={d.id} value={d.id} className="bg-popover text-popover-foreground">
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {status ? (
        <p className="mt-3 flex items-start gap-2 border-t border-white/15 pt-3 text-sm text-court-muted">
          <Swords aria-hidden className="mt-0.5 size-4 shrink-0 text-ball" />
          <span>{status}</span>
        </p>
      ) : null}
    </section>
  );
}
