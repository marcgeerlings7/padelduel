"use client";

import { ChevronLeft, ChevronRight, History } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/app/EmptyState";
import { formatSignedDelta } from "@/components/app/format";
import { CardSkeleton, ListSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { RatingDelta } from "@/components/app/RatingDelta";
import { SectionCard } from "@/components/app/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";
import { cn } from "@/lib/utils";
import { DuoMeta } from "./DuoMeta";
import { DuoSectionNav } from "./DuoSectionNav";
import { ResultTile, type TileResult } from "./ResultTile";
import { SetScoreline } from "./SetScoreline";
import { formatShortDate } from "./time";
import type { MatchHistoryItem, MatchHistoryResponse } from "./types";
import { useMyDuos } from "@/lib/client/useMyDuos";

const PAGE_SIZE = 15;

/**
 * Wedstrijdhistorie van een duo (GET /api/duos/[id]/matches): samenvatting
 * (W-V, reeks, set-/gamesaldo, betrouwbaarheid) en een gepagineerde lijst
 * met uitslag per set vanuit dit duo, ratingeffect en forfeit/ongeldig-labels.
 * Ook voor andermans duo's te bekijken (tegenstanders mogen resultaten zien).
 */
export function MatchHistoryView({ duoId }: { duoId: string }) {
  const router = useRouter();
  const { duos } = useMyDuos();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MatchHistoryResponse | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const ownDuo = duos?.find((d) => d.id === duoId) ?? null;
  const isOwn = duos === null ? true : ownDuo !== null;

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    setLoadingPage(true);
    setError(null);
    apiFetch<MatchHistoryResponse>(`/api/duos/${duoId}/matches?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err instanceof ApiError && err.status === 404 ? "Dit duo bestaat niet." : "Kon de wedstrijden niet laden.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [duoId, page, router, attempt]);

  function goTo(nextPage: number) {
    setPage(nextPage);
    listRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const duoName = data?.duo.name ?? ownDuo?.name ?? null;

  return (
    <Page>
      <PageHeader
        title="Wedstrijden"
        back={isOwn ? { href: "/dashboard", label: "Mijn duo's" } : { href: "/ladder", label: "Ladder" }}
        meta={
          error && !data ? null : (
            <>
              <DuoMeta name={duoName} regionName={ownDuo?.region.name} tier={ownDuo?.tier} own={Boolean(ownDuo)} />
              {data && !data.duo.isActive ? <Badge variant="muted">Opgeheven</Badge> : null}
            </>
          )
        }
      />

      <DuoSectionNav duoId={duoId} current="matches" own={isOwn} />

      {error ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          <p>{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            Opnieuw proberen
          </Button>
        </div>
      ) : null}

      {!data && !error ? (
        <>
          <CardSkeleton lines={4} label="Samenvatting laden…" className="h-56" />
          <ListSkeleton rows={6} label="Wedstrijden laden…" />
        </>
      ) : null}

      {data ? (
        <>
          <SummaryHero summary={data.summary} />

          <div ref={listRef} className="scroll-mt-20">
            {data.total === 0 ? (
              <EmptyState
                icon={History}
                title="Nog geen wedstrijden"
                description="Bevestigde uitslagen, forfeits en ongeldig verklaarde wedstrijden verschijnen hier."
                action={
                  isOwn ? (
                    <Button asChild>
                      <Link href={`/duos/${duoId}/challenges`}>Naar challenges</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <SectionCard
                title="Alle wedstrijden"
                description={`${data.total} in totaal, nieuwste bovenaan. Scores vanuit ${data.duo.name}.`}
                flush
              >
                <ul aria-busy={loadingPage} className={cn("transition-opacity", loadingPage && "opacity-60")}>
                  {data.entries.map((entry) => (
                    <MatchRow key={entry.matchId ?? `forfeit-${entry.challengeId}`} entry={entry} duoId={duoId} />
                  ))}
                </ul>
                {data.totalPages > 1 ? (
                  <nav
                    aria-label="Paginering"
                    className="flex items-center justify-between gap-2 border-t px-4 py-3 sm:px-5"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || loadingPage}
                      onClick={() => goTo(page - 1)}
                    >
                      <ChevronLeft aria-hidden />
                      Nieuwer
                    </Button>
                    <p className="text-sm text-muted-foreground tabular" aria-live="polite">
                      Pagina {data.page} van {data.totalPages}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages || loadingPage}
                      onClick={() => goTo(page + 1)}
                    >
                      Ouder
                      <ChevronRight aria-hidden />
                    </Button>
                  </nav>
                ) : null}
              </SectionCard>
            )}
          </div>
        </>
      ) : null}
    </Page>
  );
}

function SummaryHero({ summary }: { summary: MatchHistoryResponse["summary"] }) {
  const played = summary.wins + summary.losses;
  const winShare = played > 0 ? summary.wins / played : 0;
  const streak = summary.streakDetail;

  return (
    <section
      aria-labelledby="balans-title"
      className="court-lines relative flex flex-col gap-5 overflow-hidden rounded-2xl bg-court p-5 text-court-foreground shadow-raised sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="balans-title" className="font-display text-[1.375rem] leading-tight font-bold">
          Balans
        </h2>
        <div className="flex flex-wrap justify-end gap-1.5">
          {streak ? (
            <span className="rounded-full bg-white/12 px-2.5 py-0.5 text-xs font-semibold">
              {streak.length}× {streak.result === "W" ? "gewonnen" : "verloren"} op rij
            </span>
          ) : null}
          {summary.inactive ? (
            <span className="rounded-full bg-white/12 px-2.5 py-0.5 text-xs font-semibold">Inactief</span>
          ) : null}
        </div>
      </div>

      <div className="flex items-end gap-4">
        <p className="flex items-end gap-3 font-score leading-[0.85]">
          <span className="flex flex-col items-start gap-1.5">
            <span className="text-[4.5rem] sm:text-[5.5rem]">{summary.wins}</span>
            <span className="font-sans text-xs font-semibold text-court-muted">gewonnen</span>
          </span>
          <span aria-hidden className="pb-7 text-5xl text-court-muted">–</span>
          <span className="flex flex-col items-start gap-1.5">
            <span className="text-[4.5rem] text-court-foreground/70 sm:text-[5.5rem]">{summary.losses}</span>
            <span className="font-sans text-xs font-semibold text-court-muted">verloren</span>
          </span>
        </p>
      </div>

      {played > 0 ? (
        <div
          role="img"
          aria-label={`${Math.round(winShare * 100)}% van de wedstrijden gewonnen`}
          className="flex h-2 overflow-hidden rounded-full bg-white/15"
        >
          <span className="h-full rounded-full bg-court-foreground" style={{ width: `${winShare * 100}%` }} />
        </div>
      ) : null}

      <dl className="grid grid-cols-3 items-end gap-3 border-t border-white/15 pt-4">
        <HeroStat label="Setsaldo" value={formatSignedDelta(summary.setDifference)} hint={`${summary.setsWon}–${summary.setsLost}`} />
        <HeroStat label="Gamesaldo" value={formatSignedDelta(summary.gameDifference)} hint={`${summary.gamesWon}–${summary.gamesLost}`} />
        <HeroStat
          label="Betrouwbaarheid"
          value={summary.reliability.percentage === null ? "—" : `${summary.reliability.percentage}%`}
          hint={
            summary.reliability.total > 0
              ? `${summary.reliability.played} van ${summary.reliability.total} gespeeld`
              : "Nog geen challenges"
          }
        />
      </dl>
    </section>
  );
}

function HeroStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs leading-tight font-semibold break-words hyphens-auto text-court-muted">{label}</dt>
      <dd className="font-score text-[1.75rem] leading-none">{value}</dd>
      <dd className="truncate text-xs text-court-muted tabular">{hint}</dd>
    </div>
  );
}

function tileFor(entry: MatchHistoryItem): TileResult {
  if (entry.kind === "forfeit") return "forfeit";
  if (entry.kind === "voided") return "voided";
  return entry.result === "W" ? "W" : "L";
}

function MatchRow({ entry, duoId }: { entry: MatchHistoryItem; duoId: string }) {
  const tile = tileFor(entry);
  const roleText = entry.role === "challenger" ? "uitdager" : "uitgedaagd";

  return (
    <li className="flex items-center gap-3 border-t px-4 py-3 sm:px-5">
      <ResultTile result={tile} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/duos/${duoId}/head-to-head/${entry.opponent.id}`}
          className="w-fit max-w-full truncate rounded-sm font-semibold text-foreground no-underline hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="text-muted-foreground">vs.</span> {entry.opponent.name}
        </Link>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <time dateTime={entry.date}>{formatShortDate(entry.date)}</time>
          <span>{roleText}</span>
          {entry.kind === "voided" ? <Badge variant="muted">Ongeldig verklaard</Badge> : null}
          {entry.kind === "forfeit" ? (
            <Badge variant="loss">
              {entry.forfeitReason === "expired" ? "Forfeit: niet gereageerd" : "Forfeit: niet gespeeld"}
            </Badge>
          ) : null}
          {entry.forfeitCorrected ? <Badge variant="win">Gecorrigeerd</Badge> : null}
          {entry.resultType === "walkover" ? (
            <Badge variant="outline" title={entry.concededBy === "self" ? "Jullie kwamen niet opdagen" : "Tegenstander kwam niet opdagen"}>
              {entry.concededBy === "self" ? "Walkover (jullie afwezig)" : "Walkover"}
            </Badge>
          ) : null}
          {entry.resultType === "retired" ? (
            <Badge variant="outline">
              {entry.concededBy === "self" ? "Opgave door jullie" : "Opgave tegenstander"}
              {entry.playedScore ? ` bij ${entry.playedScore.replace(/,/g, " ")}` : ""}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {entry.sets && entry.sets.length > 0 ? (
          <SetScoreline sets={entry.sets} size="sm" voided={entry.kind === "voided"} />
        ) : null}
        {entry.ratingDelta !== null && entry.kind !== "voided" ? (
          <RatingDelta value={entry.ratingDelta} forfeit={entry.isForfeit} />
        ) : null}
      </div>
    </li>
  );
}
