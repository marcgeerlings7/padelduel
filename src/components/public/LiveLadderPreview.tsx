"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import { m } from "motion/react";
import { apiFetch } from "@/lib/client/api";
import { DuoAvatar } from "@/components/app/DuoAvatar";
import { RankBadge } from "@/components/app/RankBadge";
import { TierBadge } from "@/components/app/TierBadge";
import { formatRating } from "@/components/app/format";
import { fadeUp, staggerList } from "@/components/app/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { groupTopByTier, type PreviewEntry } from "./landing-data";

type Region = { id: string; name: string; slug: string };
type LadderResponse = { region: Region; ladder: PreviewEntry[]; tierSize: number };

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty-regions" }
  | { status: "ready"; data: LadderResponse };

const PREVIEW_ROWS = 5;

/**
 * Het bovenste stuk van de echte, publieke ladder (GET /api/ladder) — geen
 * voorbeelddata. Gegroepeerd per tier, zodat meteen zichtbaar is binnen
 * welke groep duo's elkaar mogen uitdagen.
 */
export function LiveLadderPreview({ className }: { className?: string }) {
  const [regions, setRegions] = useState<Region[] | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    apiFetch<Region[]>("/api/regions")
      .then((data) => {
        if (cancelled) return;
        setRegions(data);
        if (data.length === 0) setState({ status: "empty-regions" });
        else setSlug((current) => current ?? data[0].slug);
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setState({ status: "loading" });
    apiFetch<LadderResponse>(`/api/ladder?regionSlug=${encodeURIComponent(slug)}`)
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  const regionName = state.status === "ready" ? state.data.region.name : regions?.find((r) => r.slug === slug)?.name;

  return (
    <section
      aria-labelledby="live-ladder-title"
      className={cn("flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground shadow-raised", className)}
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 pt-4 pb-3">
        <div className="flex min-w-0 flex-col">
          <h2 id="live-ladder-title" className="font-display text-xl leading-tight font-bold">
            Ladder{regionName ? ` ${regionName}` : ""}
          </h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-win" />
            {state.status === "ready"
              ? `Actuele stand, ${state.data.ladder.length} ${state.data.ladder.length === 1 ? "duo" : "duo's"}`
              : "Actuele stand"}
          </p>
        </div>
        {regions && regions.length > 1 ? (
          <label className="shrink-0">
            <span className="sr-only">Regio</span>
            <select
              value={slug ?? ""}
              onChange={(e) => setSlug(e.target.value)}
              className="h-9 rounded-md border border-input bg-card px-2 text-base sm:text-sm"
            >
              {regions.map((r) => (
                <option key={r.id} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <div role="status" aria-busy="true" className="flex flex-col">
          <span className="sr-only">Ladder laden…</span>
          {Array.from({ length: PREVIEW_ROWS }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
      ) : state.status === "error" ? (
        <div className="flex flex-col items-start gap-3 px-4 py-5">
          <p role="alert" className="text-sm text-loss">
            De ladder kon niet geladen worden.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Opnieuw proberen
          </button>
        </div>
      ) : state.status === "empty-regions" || state.data.ladder.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Trophy aria-hidden className="size-5" />
          </span>
          <p className="font-display text-lg leading-tight font-bold">Nog geen duo&apos;s op de ladder</p>
          <p className="max-w-[30ch] text-sm text-muted-foreground">
            Maak een account aan en vorm het eerste duo van {regionName ?? "je regio"}.
          </p>
        </div>
      ) : (
        <LadderRows data={state.data} />
      )}

      <Link
        href="/ladder"
        className="group mt-auto flex items-center justify-between gap-2 border-t px-4 py-3 text-sm font-semibold text-primary no-underline hover:bg-accent"
      >
        Bekijk de volledige ladder
        <ChevronRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}

function LadderRows({ data }: { data: LadderResponse }) {
  const groups = groupTopByTier(data.ladder, PREVIEW_ROWS);
  return (
    <m.div variants={staggerList} initial="hidden" animate="visible" className="flex flex-col">
      {groups.map((group) => (
        <div key={group.tier} role="group" aria-label={`Tier ${group.tier}`}>
          <div className="flex items-center justify-between gap-2 bg-muted/60 px-4 py-1.5">
            <TierBadge tier={group.tier} className="border-0 bg-transparent px-0" />
            <span className="text-xs text-muted-foreground tabular">
              {formatRating(group.tier * data.tierSize)}–{formatRating((group.tier + 1) * data.tierSize - 1)} punten
            </span>
          </div>
          <ol className="flex flex-col">
            {group.entries.map((duo) => (
              <m.li
                key={duo.id}
                variants={fadeUp}
                className="flex items-center gap-3 border-t px-4 py-2.5 first:border-t-0"
              >
                <RankBadge position={duo.position} size="sm" />
                <DuoAvatar name={duo.name} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{duo.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular">
                      <span className="sr-only">Gewonnen–verloren: </span>
                      {duo.wins}–{duo.losses}
                    </span>
                    {duo.streak !== "—" ? <StreakPill streak={duo.streak} /> : null}
                  </span>
                </div>
                <span className="font-score text-2xl">
                  <span className="sr-only">Rating </span>
                  {formatRating(duo.currentRating)}
                </span>
              </m.li>
            ))}
          </ol>
        </div>
      ))}
    </m.div>
  );
}

function StreakPill({ streak }: { streak: string }) {
  const winning = streak.startsWith("W");
  const length = streak.slice(1);
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[0.6875rem] font-semibold tabular",
        winning ? "bg-win-soft text-win" : "bg-loss-soft text-loss",
      )}
    >
      {winning ? `${length} op rij gewonnen` : `${length} op rij verloren`}
    </span>
  );
}
