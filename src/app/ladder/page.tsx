"use client";

import { CircleCheck, LogIn, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/app/EmptyState";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ActingDuoPanel } from "@/components/ladder/ActingDuoPanel";
import { LadderTable } from "@/components/ladder/LadderTable";
import { NativeSelect } from "@/components/ladder/NativeSelect";
import type { LadderRow } from "@/components/ladder/ladder-model";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type Region = { id: string; name: string; slug: string };
type LadderResponse = { region: Region; ladder: LadderRow[]; tierSize: number };
type MyDuo = { id: string; name: string; regionId: string; tier: number };
type ChallengeSummary = { status: string };

export default function LadderPage() {
  const [regions, setRegions] = useState<Region[] | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [ladder, setLadder] = useState<LadderRow[] | null>(null);
  const [tierSize, setTierSize] = useState<number | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [myDuos, setMyDuos] = useState<MyDuo[] | null>(null);
  const [actingDuoId, setActingDuoId] = useState<string>("");
  const [actingDuoBusy, setActingDuoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{
    duoName: string;
    fromDuoId: string;
  } | null>(null);
  const [challengingId, setChallengingId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Region[]>("/api/regions")
      .then((data) => {
        setRegions(data);
        if (data.length > 0) setSelectedSlug(data[0].slug);
      })
      .catch(() => {
        setRegions([]);
        setError("Kon de regio's niet laden. Ververs de pagina om het opnieuw te proberen.");
      });
  }, []);

  useEffect(() => {
    const hasToken = Boolean(getStoredToken());
    setLoggedIn(hasToken);
    if (!hasToken) {
      setMyDuos([]);
      return;
    }
    apiFetch<MyDuo[]>("/api/duos/mine")
      .then(setMyDuos)
      .catch(() => {
        /* sessie verlopen of geen duo's: geen markering, geen harde fout */
        setMyDuos([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    let cancelled = false;
    setLadder(null);
    setError(null);
    setSent(null);
    apiFetch<LadderResponse>(`/api/ladder?regionSlug=${encodeURIComponent(selectedSlug)}`)
      .then((data) => {
        if (cancelled) return;
        setLadder(data.ladder);
        setTierSize(data.tierSize);
      })
      .catch(() => {
        if (!cancelled) setError("Kon de ladder niet laden. Ververs de pagina om het opnieuw te proberen.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  const selectedRegion = regions?.find((r) => r.slug === selectedSlug) ?? null;

  // useMemo (i.p.v. inline berekenen) zodat de effect hieronder correct
  // opnieuw draait zodra ladder/regions/myDuos alsnog binnenkomen — met een
  // plain const zou de effect een update missen wanneer myDuos vóór de
  // ladder-data geladen werd (race condition).
  const myDuosInRegion = useMemo(
    () => (myDuos ?? []).filter((d) => ladder && ladder.length > 0 && selectedRegion?.id === d.regionId),
    [myDuos, ladder, selectedRegion],
  );

  const ownDuoIds = useMemo(() => new Set((myDuos ?? []).map((d) => d.id)), [myDuos]);

  useEffect(() => {
    setActingDuoId(myDuosInRegion[0]?.id ?? "");
  }, [myDuosInRegion]);

  useEffect(() => {
    if (!actingDuoId) {
      setActingDuoBusy(false);
      return;
    }
    let cancelled = false;
    apiFetch<ChallengeSummary[]>(`/api/duos/${actingDuoId}/challenges`)
      .then((challenges) => {
        if (!cancelled) {
          setActingDuoBusy(challenges.some((c) => c.status === "PENDING" || c.status === "ACCEPTED"));
        }
      })
      .catch(() => {
        if (!cancelled) setActingDuoBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actingDuoId]);

  const actingDuo = myDuosInRegion.find((d) => d.id === actingDuoId) ?? null;
  const actingEntry = (actingDuo && ladder?.find((e) => e.id === actingDuo.id)) || null;
  const challengeableCount =
    actingDuo && ladder ? ladder.filter((e) => e.tier === actingDuo.tier && !ownDuoIds.has(e.id)).length : 0;

  async function handleChallenge(challengedDuoId: string, challengedName: string) {
    if (!actingDuoId) return;
    setChallengingId(challengedDuoId);
    setSent(null);
    setError(null);
    try {
      await apiFetch("/api/challenges", {
        method: "POST",
        body: JSON.stringify({ challengerDuoId: actingDuoId, challengedDuoId }),
      });
      setSent({ duoName: challengedName, fromDuoId: actingDuoId });
      setActingDuoBusy(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Uitdagen is mislukt. Probeer het opnieuw.");
    } finally {
      setChallengingId(null);
    }
  }

  const tierCount = ladder && ladder.length > 0 ? new Set(ladder.map((e) => e.tier)).size : 0;
  const description =
    ladder && selectedRegion
      ? ladder.length === 0
        ? `Nog geen actieve duo's in ${selectedRegion.name}.`
        : `${ladder.length} ${ladder.length === 1 ? "duo" : "duo's"} in ${selectedRegion.name}, verdeeld over ${tierCount} ${
            tierCount === 1 ? "tier" : "tiers"
          }${tierSize ? ` van ${tierSize} punten` : ""}. Uitdagen kan binnen je eigen tier.`
      : "De ranglijst van je regio, op rating.";

  const loadingOwnState = loggedIn === null || (loggedIn && myDuos === null);

  return (
    <Page width="wide">
      <PageHeader
        title="Ladder"
        description={description}
        actions={
          regions && regions.length > 0 ? (
            <div className="flex w-full items-center gap-3 sm:grid sm:w-56 sm:gap-1.5">
              <label htmlFor="ladder-region" className="shrink-0 text-sm font-semibold text-muted-foreground sm:text-xs">
                Regio
              </label>
              <NativeSelect
                id="ladder-region"
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
              >
                {regions.map((region) => (
                  <option key={region.id} value={region.slug}>
                    {region.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : regions === null ? (
            <Skeleton className="h-10 w-full sm:w-56" />
          ) : null
        }
      />

      {/* Jouw duo / inlog-uitnodiging */}
      {loadingOwnState || (ladder === null && !error) ? (
        <Skeleton className="h-36 w-full rounded-2xl" />
      ) : actingDuo ? (
        <ActingDuoPanel
          ownDuos={myDuosInRegion}
          actingDuoId={actingDuoId}
          onActingDuoChange={(id) => {
            setSent(null);
            setActingDuoId(id);
          }}
          entry={actingEntry}
          ladderSize={ladder?.length ?? 0}
          challengeableCount={challengeableCount}
          busy={actingDuoBusy}
        />
      ) : !loggedIn ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Zelf meedoen?</span> Log in om duo&apos;s in je
            eigen tier uit te dagen.
          </p>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/login">
              <LogIn aria-hidden />
              Inloggen
            </Link>
          </Button>
        </div>
      ) : ladder && selectedRegion ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Je hebt geen duo in {selectedRegion.name}.</span>{" "}
            Stel een duo voor om op deze ladder te komen.
          </p>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/duos/propose">
              <UsersRound aria-hidden />
              Duo voorstellen
            </Link>
          </Button>
        </div>
      ) : null}

      {sent ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-lg border border-win/30 bg-win-soft px-4 py-3 text-sm text-win sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-center gap-2 font-semibold">
            <CircleCheck aria-hidden className="size-4 shrink-0" />
            Uitdaging verstuurd aan {sent.duoName}.
          </p>
          <Link
            href={`/duos/${sent.fromDuoId}/challenges`}
            className="font-semibold underline underline-offset-4"
          >
            Bekijk je challenges
          </Link>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss"
        >
          {error}
        </div>
      ) : null}

      {ladder === null ? (
        error ? null : (
          <LadderSkeleton />
        )
      ) : ladder.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={`Nog geen duo's in ${selectedRegion?.name ?? "deze regio"}`}
          description="Zodra een duo in deze regio actief is, verschijnt het hier op de ladder."
          action={
            loggedIn ? (
              <Button asChild>
                <Link href="/duos/propose">Duo voorstellen</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <LadderTable
          ladder={ladder}
          tierSize={tierSize}
          ownDuoIds={ownDuoIds}
          regionName={selectedRegion?.name ?? ""}
          challenge={{
            actingDuo: actingDuo ? { id: actingDuo.id, tier: actingDuo.tier } : null,
            busy: actingDuoBusy,
            pendingId: challengingId,
            onChallenge: handleChallenge,
          }}
        />
      )}

      {ladder && ladder.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          W–V: gewonnen–verloren. Reeks: huidige winst- (W) of verliesreeks (L). Betrouwbaar: aandeel
          challenges dat daadwerkelijk gespeeld is. Inactief: al een tijd geen wedstrijd gespeeld.{" "}
          <Link href="/info" className="font-semibold text-primary underline-offset-4 hover:underline">
            Meer uitleg
          </Link>
        </p>
      ) : null}
    </Page>
  );
}

function LadderSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="overflow-hidden rounded-xl border bg-card shadow-card"
    >
      <span className="sr-only">Ladder laden…</span>
      <div className="border-b px-4 py-2.5 sm:px-5">
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0 sm:px-5">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4 sm:hidden" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}
