"use client";

import { Swords } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DuoAvatar } from "@/components/app/DuoAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import { formatSignedDelta } from "@/components/app/format";
import { CardSkeleton, ListSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { RatingDelta } from "@/components/app/RatingDelta";
import { SectionCard } from "@/components/app/SectionCard";
import { StatCard } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";
import { cn } from "@/lib/utils";
import { ResultTile } from "./ResultTile";
import { SetScoreline } from "./SetScoreline";
import { formatDate } from "./time";
import type { HeadToHeadMeetingItem, HeadToHeadResponse } from "./types";

/**
 * Onderling resultaat van duo `duoId` tegen `otherId`
 * (GET /api/duos/[id]/head-to-head/[otherId]): grote W-V-vergelijking,
 * set- en gamesaldo en alle bevestigde ontmoetingen. Forfeits tellen niet mee.
 */
export function HeadToHeadView({ duoId, otherId }: { duoId: string; otherId: string }) {
  const router = useRouter();
  const [data, setData] = useState<HeadToHeadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    setError(null);
    apiFetch<HeadToHeadResponse>(`/api/duos/${duoId}/head-to-head/${otherId}`)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError(
          err instanceof ApiError && (err.status === 404 || err.status === 400)
            ? err.message
            : "Kon het onderlinge resultaat niet laden.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [duoId, otherId, router, attempt]);

  return (
    <Page>
      <PageHeader
        title="Onderling resultaat"
        back={{ href: `/duos/${duoId}/matches`, label: "Wedstrijden" }}
        description={
          data ? `${data.duo.name} tegen ${data.opponent.name}. Alleen bevestigde wedstrijden tellen mee.` : undefined
        }
      />

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
          <CardSkeleton lines={4} label="Onderling resultaat laden…" className="h-60" />
          <ListSkeleton rows={3} />
        </>
      ) : null}

      {data ? (
        <>
          <Scoreboard data={data} />

          {data.matches > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Sets"
                value={`${data.setsWon}–${data.setsLost}`}
                hint={`Saldo ${formatSignedDelta(data.setDifference)}`}
              />
              <StatCard
                label="Games"
                value={`${data.gamesWon}–${data.gamesLost}`}
                hint={`Saldo ${formatSignedDelta(data.gameDifference)}`}
              />
            </div>
          ) : null}

          {data.matches === 0 ? (
            <EmptyState
              icon={Swords}
              title="Nog nooit tegen elkaar gespeeld"
              description={`Zodra ${data.duo.name} en ${data.opponent.name} een bevestigde wedstrijd spelen, verschijnt die hier.`}
              action={
                <Button asChild>
                  <Link href="/ladder">Naar de ladder</Link>
                </Button>
              }
            />
          ) : (
            <SectionCard
              title="Ontmoetingen"
              description={`Nieuwste bovenaan, scores vanuit ${data.duo.name}.`}
              flush
            >
              <ul>
                {data.meetings.map((meeting) => (
                  <MeetingRow key={meeting.matchId} meeting={meeting} opponentName={data.opponent.name} />
                ))}
              </ul>
            </SectionCard>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/duos/${data.opponent.id}/matches`}>Wedstrijden van {data.opponent.name}</Link>
            </Button>
          </div>
        </>
      ) : null}
    </Page>
  );
}

function Scoreboard({ data }: { data: HeadToHeadResponse }) {
  const leader = data.wins > data.losses ? "duo" : data.losses > data.wins ? "opponent" : null;
  const share = data.matches > 0 ? data.wins / data.matches : 0.5;

  return (
    <section
      aria-label={`Stand onderling: ${data.duo.name} ${data.wins}, ${data.opponent.name} ${data.losses}`}
      className="court-lines relative flex flex-col gap-5 overflow-hidden rounded-2xl bg-court p-5 text-court-foreground shadow-raised sm:p-7"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-3 sm:gap-x-6">
        <Team name={data.duo.name} />
        <span aria-hidden />
        <Team name={data.opponent.name} />
        <Wins value={data.wins} leading={leader === "duo"} />
        <span aria-hidden className="font-score text-4xl text-court-muted sm:text-5xl">
          –
        </span>
        <Wins value={data.losses} leading={leader === "opponent"} />
      </div>

      <div aria-hidden className="flex h-2 gap-1">
        <span className="rounded-full bg-court-foreground" style={{ flexGrow: Math.max(share, 0.02) }} />
        <span className="rounded-full bg-white/20" style={{ flexGrow: Math.max(1 - share, 0.02) }} />
      </div>

      <p className="text-center text-sm text-court-muted">
        {data.matches === 0
          ? "Nog geen ontmoetingen"
          : data.matches === 1
            ? "1 ontmoeting"
            : `${data.matches} ontmoetingen`}
        {leader === null && data.matches > 0 ? ", gelijk op" : null}
      </p>
    </section>
  );
}

function Team({ name }: { name: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <DuoAvatar name={name} size="lg" className="ring-2 ring-white/25" />
      <p className="w-full truncate text-sm font-semibold" title={name}>
        {name}
      </p>
    </div>
  );
}

function Wins({ value, leading }: { value: number; leading: boolean }) {
  return (
    <p
      className={cn(
        "text-center font-score text-[4.5rem] leading-[0.85] sm:text-[6rem]",
        !leading && "text-court-foreground/60",
      )}
    >
      {value}
    </p>
  );
}

function MeetingRow({ meeting, opponentName }: { meeting: HeadToHeadMeetingItem; opponentName: string }) {
  return (
    <li className="flex items-center gap-3 border-t px-4 py-3 sm:px-5">
      <ResultTile result={meeting.result} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-semibold">
          <time dateTime={meeting.date}>{formatDate(meeting.date)}</time>
        </p>
        <p className="text-xs text-muted-foreground">
          {meeting.role === "challenger" ? `Uitdaging aan ${opponentName}` : `Uitgedaagd door ${opponentName}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <SetScoreline sets={meeting.sets} size="sm" />
        {meeting.ratingDelta !== null ? <RatingDelta value={meeting.ratingDelta} /> : null}
      </div>
    </li>
  );
}
